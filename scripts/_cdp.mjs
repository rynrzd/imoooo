/**
 * Pilotage d'un vrai navigateur (Edge/Chrome headless) par CDP — socle partagé.
 * Aucune dépendance npm : WebSocket natif de Node.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BROWSER_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

function browserPath() {
  const found = BROWSER_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("Aucun navigateur Chromium trouvé (Edge ou Chrome).");
  return found;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9300 + (Date.now() % 400) } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "nireo-cdp-"));
  const child = spawn(
    browserPath(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
    { stdio: "ignore" }
  );

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
    } catch {
      /* pas encore prêt */
    }
    if (!wsUrl) await sleep(400);
  }
  if (!wsUrl) throw new Error("Le navigateur n'a pas démarré");

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r));

  let seq = 0;
  const rpc = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const id = ++seq;
      const on = (ev) => {
        const d = JSON.parse(ev.data);
        if (d.id !== id) return;
        ws.removeEventListener("message", on);
        if (d.error) rej(new Error(`${method}: ${d.error.message}`));
        else res(d.result);
      };
      ws.addEventListener("message", on);
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        ws.removeEventListener("message", on);
        rej(new Error(`${method} timeout`));
      }, 45000);
    });

  /**
   * Fermeture RÉELLE du navigateur.
   *
   * `child.kill()` ne suffit pas : Chromium lance une dizaine de processus
   * enfants (rendu, GPU, réseau, utilitaires) et tuer le seul parent les
   * laisse tous vivants. Au fil d'une campagne d'audit, 124 processus Edge
   * orphelins et 60 profils temporaires se sont accumulés ici jusqu'à épuiser
   * la mémoire de la machine — et à faire échouer un `next build` sur
   * « memory allocation failed ». D'où l'arbre complet (`/T`), et la purge du
   * profil derrière.
   */
  const close = async () => {
    // 1. La bonne méthode : demander au navigateur de se fermer lui-même. Lui
    //    seul connaît TOUS ses processus — Chromium en re-parente une partie,
    //    et `taskkill /T` sur le seul PID lancé en laisse alors derrière.
    try {
      await Promise.race([rpc("Browser.close"), sleep(3000)]);
    } catch { /* déjà parti */ }
    try { ws.close(); } catch { /* déjà fermé */ }

    // 2. Filet de sécurité : l'arbre du processus lancé.
    if (child.pid) {
      try {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch { /* pas sous Windows */ }
    }
    try { child.kill("SIGKILL"); } catch { /* déjà mort */ }

    // 3. Le profil, sinon il reste des dizaines de dossiers dans %TEMP%.
    await sleep(400);
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* verrouillé */ }
  };

  return { ws, rpc, close };
}

/** Ouvre un onglet isolé et renvoie de quoi le piloter. */
export async function newPage({ ws, rpc }) {
  const { targetId } = await rpc("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await rpc("Target.attachToTarget", { targetId, flatten: true });
  for (const d of ["Page", "Runtime", "Log", "Network"]) await rpc(`${d}.enable`, {}, sessionId);

  const state = { errors: [], failedRequests: [] };
  const urls = new Map();
  ws.addEventListener("message", (ev) => {
    const d = JSON.parse(ev.data);
    if (d.sessionId !== sessionId) return;
    if (d.method === "Log.entryAdded" && d.params?.entry?.level === "error") {
      state.errors.push(String(d.params.entry.text).slice(0, 200));
    }
    if (d.method === "Runtime.exceptionThrown") {
      state.errors.push(String(d.params?.exceptionDetails?.text ?? "exception").slice(0, 200));
    }
    if (d.method === "Network.responseReceived" && d.params?.response?.status >= 400) {
      state.failedRequests.push(`${d.params.response.status} ${String(d.params.response.url).slice(0, 130)}`);
    }
    if (d.method === "Network.requestWillBeSent") {
      urls.set(d.params.requestId, d.params.request?.url ?? "?");
    }
    // Une erreur réseau (DNS, TLS, refus) ne produit AUCUNE réponse : sans
    // ceci, elle n'apparaît nulle part et on ne sait pas QUELLE URL a échoué.
    if (d.method === "Network.loadingFailed" && !d.params?.canceled) {
      state.failedRequests.push(
        `${d.params.errorText} ${String(urls.get(d.params.requestId) ?? "?").slice(0, 130)}`
      );
    }
  });

  const evaluate = async (expression) => {
    const r = await rpc("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "evaluate a échoué");
    return r.result.value;
  };

  const resize = (width, height = 900) =>
    rpc("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 }, sessionId);

  /**
   * Navigue et attend que la page soit RÉELLEMENT prête.
   *
   * Le texte seul ne suffit pas : un écran de squelettes n'a pas de texte, il
   * se « stabilise » donc immédiatement et on mesurerait une page en cours de
   * chargement — d'où des verdicts faux (« pas de h1 », « état vide absent »).
   * On exige en plus l'absence de tout `aria-busy="true"` et de tout squelette.
   */
  const goto = async (url, { settle = 2, maxTries = 30 } = {}) => {
    state.errors = [];
    state.failedRequests = [];
    await rpc("Page.navigate", { url }, sessionId);
    let last = null;
    let stable = 0;
    for (let i = 0; i < maxTries; i++) {
      await sleep(500);
      let snap;
      try {
        snap = await evaluate(
          `(() => {
            if (!document.body) return null;
            const busy = document.querySelector('[aria-busy="true"], [data-slot="skeleton"]');
            return JSON.stringify({
              t: document.body.innerText.replace(/\\s+/g, " ").slice(0, 4000),
              busy: Boolean(busy),
            });
          })()`
        );
      } catch {
        continue;
      }
      if (!snap) continue;
      const { t, busy } = JSON.parse(snap);
      if (busy) { stable = 0; last = t; continue; }
      if (t && t === last) {
        if (++stable >= settle) break;
      } else {
        stable = 0;
      }
      last = t;
    }
    return last ?? "";
  };

  const key = (type, keyName, extra = {}) =>
    rpc("Input.dispatchKeyEvent", { type, key: keyName, ...extra }, sessionId);

  const pressTab = async (shift = false) => {
    const modifiers = shift ? 8 : 0;
    await key("rawKeyDown", "Tab", { windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers });
    await key("keyUp", "Tab", { windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers });
    await sleep(70);
  };

  const pressKey = async (keyName, code) => {
    await key("rawKeyDown", keyName, { windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    await key("keyUp", keyName, { windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    await sleep(150);
  };

  const setCookie = (params) => rpc("Network.setCookie", params, sessionId);

  const screenshot = async () => (await rpc("Page.captureScreenshot", { format: "png" }, sessionId)).data;

  return { sessionId, state, evaluate, resize, goto, pressTab, pressKey, setCookie, screenshot, rpc };
}

export function reporter() {
  const rows = [];
  return {
    rows,
    check(name, ok, detail = "") {
      rows.push({ name, ok, detail });
      console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
      return ok;
    },
    note(name, detail = "") {
      rows.push({ name, ok: null, detail });
      console.log(`INFO  ${name}${detail ? ` — ${detail}` : ""}`);
    },
    summary() {
      const graded = rows.filter((r) => r.ok !== null);
      const passed = graded.filter((r) => r.ok).length;
      console.log(`\n${passed}/${graded.length} PASS`);
      return { passed, total: graded.length, failures: graded.filter((r) => !r.ok) };
    },
  };
}
