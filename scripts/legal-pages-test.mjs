/**
 * Vérifie que les pages légales affichent l'identité RÉELLE de l'éditeur,
 * qu'elles ne se contredisent pas, et qu'aucune donnée n'a été inventée.
 *
 * Usage :  node scripts/legal-pages-test.mjs [url]
 *   défaut : http://localhost:3126  (lancer `npm run build && npm start`)
 *   exemple : node scripts/legal-pages-test.mjs https://nireo.fr
 *
 * Utilise un vrai navigateur (Edge headless) : les pages sont rendues comme
 * pour un visiteur, pas lues dans le code source.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3126";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9300 + (Date.now() % 400);
const dir = mkdtempSync(join(tmpdir(), "nireo-legal-"));
const edge = spawn(EDGE, [`--headless=new`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "--hide-scrollbars", "--no-first-run", "--disable-gpu"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
function rpc(ws, m, p = {}, s) {
  return new Promise((res, rej) => {
    const msg = { id: ++id, method: m, params: p, ...(s ? { sessionId: s } : {}) };
    const on = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id !== msg.id) return;
      ws.removeEventListener("message", on);
      if (d.error) rej(new Error(m + ": " + d.error.message));
      else res(d.result);
    };
    ws.addEventListener("message", on); ws.send(JSON.stringify(msg));
    setTimeout(() => { ws.removeEventListener("message", on); rej(new Error(m + " timeout")); }, 40000);
  });
}
const R = [];
const ck = (n, ok, d = "") => { R.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {} if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener("open", r));
  const { targetId } = await rpc(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await rpc(ws, "Target.attachToTarget", { targetId, flatten: true });
  for (const d of ["Page", "Runtime", "Log"]) await rpc(ws, d + ".enable", {}, sessionId);
  await rpc(ws, "Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" }, sessionId);
  let errs = [];
  ws.addEventListener("message", (ev) => { const d = JSON.parse(ev.data); if (d.method === "Log.entryAdded" && d.params?.entry?.level === "error") errs.push(d.params.entry.text?.slice(0, 110)); });

  const read = async (path, w) => {
    await rpc(ws, "Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 }, sessionId);
    errs = [];
    await rpc(ws, "Page.navigate", { url: BASE + path }, sessionId);
    let last = "";
    for (let i = 0; i < 20; i++) {
      await sleep(900);
      const o = JSON.parse((await rpc(ws, "Runtime.evaluate", { expression: `(()=>{const de=document.documentElement;return JSON.stringify({t:document.body.innerText.replace(/\\s+/g,' '),over:de.scrollWidth>de.clientWidth+2})})()`, returnByValue: true }, sessionId)).result.value);
      if (o.t.length > 300 && o.t === last) return o;
      last = o.t;
    }
    return { t: last, over: false };
  };

  const ml = await read("/mentions-legales", 390);
  ck("Mentions : nom de l'éditeur", ml.t.includes("Nouh Tifouti"));
  ck("Mentions : SIREN officiel 979 992 443", ml.t.includes("979 992 443"));
  ck("Mentions : téléphone", ml.t.includes("07 81 69 74 77"));
  ck("Mentions : courriel", ml.t.includes("nireo.contacte@gmail.com"));
  ck("Mentions : rue fournie", ml.t.includes("1 avenue d'Alsace") || ml.t.includes("1 avenue d\u2019Alsace"));
  ck("Mentions : directeur de la publication", ml.t.includes("Directeur de la publication"));
  ck("Mentions : hébergeur Vercel vérifié", ml.t.includes("Vercel Inc.") && ml.t.includes("440 N Barranca") && ml.t.includes("Covina, CA 91723"));
  ck("Mentions : aucun téléphone Vercel inventé", ml.t.includes("ne publie pas de numéro de téléphone"));
  ck("Mentions : ville/CP signalés manquants", ml.t.includes("code postal et ville"));
  ck("Mentions : SIRET signalé manquant", ml.t.includes("SIRET"));
  ck("Mentions : AUCUN faux SIRET (14 chiffres)", !/\b\d{14}\b/.test(ml.t.replace(/\s/g, "")));
  ck("Mentions : pas de débordement", !ml.over);
  ck("Mentions : 0 erreur console", errs.length === 0, errs.join(" | "));

  const cgu = await read("/cgu", 390);
  ck("CGU : plus de « lors de l'activation du paiement »", !cgu.t.includes("lors de l'activation du paiement") && !cgu.t.includes("lors de l\u2019activation du paiement"));
  ck("CGU : droit de rétractation présent", cgu.t.includes("rétractation") && cgu.t.includes("quatorze"));
  ck("CGU : exécution immédiate traitée", cgu.t.includes("montant proportionnel"));
  ck("CGU : aucune promesse commerciale inventée", !/satisfait ou remboursé|remboursement garanti|remboursement automatique/i.test(cgu.t));
  ck("CGU : médiation mentionnée + organisme signalé manquant", cgu.t.includes("médiateur de la consommation") && cgu.t.includes("À COMPLÉTER"));
  ck("CGU : portabilité distinguée de l'outil d'export", cgu.t.includes("quel que soit votre plan") || cgu.t.includes("y compris le plan Gratuit"));
  ck("CGU : pas de débordement", !cgu.over);

  const conf = await read("/confidentialite", 390);
  ck("Confidentialité : responsable de traitement nommé", conf.t.includes("Nouh Tifouti"));
  ck("Confidentialité : CNIL mentionnée", conf.t.includes("CNIL"));
  ck("Confidentialité : cookies cohérents avec /cookies", conf.t.includes("uniquement si vous les acceptez"));
  ck("Confidentialité : droit à la portabilité non conditionné au plan", conf.t.includes("ne dépendent d'aucun abonnement") || conf.t.includes("quel que soit votre plan"));
  ck("Confidentialité : pas de débordement", !conf.over);

  const cook = await read("/cookies", 390);
  ck("Cookies : aucun emplacement à compléter", !cook.t.includes("À COMPLÉTER"));
  ck("Cookies : nireo_vid documenté", cook.t.includes("nireo_vid"));
  ck("Cookies : nireo_vst documenté", cook.t.includes("nireo_vst"));
  ck("Cookies : plus d'affirmation « Aucun à ce jour »", !cook.t.includes("Aucun à ce jour"));

  const tarifs = await read("/tarifs", 1440);
  ck("Tarifs : prix 9,99 / 14,99 / 23,99", tarifs.t.includes("9,99") && tarifs.t.includes("14,99") && tarifs.t.includes("23,99"));
  ck("Tarifs : le prix affiché est le prix payé (TTC)", /TTC/.test(tarifs.t));
  ck("Tarifs : aucune affirmation de régime de TVA non confirmée", !/TVA\s*(à|:)?\s*\d|taux de TVA|TVA non applicable|293 B|hors taxe|\bHT\b|FR\d{2}\s?\d{9}/i.test(tarifs.t));
  ck("Footer : liens légaux présents", tarifs.t.includes("Mentions légales") && tarifs.t.includes("CGU"));

  const insc = await read("/inscription", 390);
  ck("Inscription : renvoi vers CGU/confidentialité", /CGU|conditions/i.test(insc.t) && /confidentialit/i.test(insc.t));
  ck("Inscription : pas de débordement", !insc.over);
} catch (e) { console.log("ERREUR:", e.message); }
finally {
  edge.kill();
  console.log(`\n${R.filter((x) => x.ok).length}/${R.length} PASS`);
  const f = R.filter((x) => !x.ok);
  if (f.length) { console.log("ÉCHECS :\n" + f.map((x) => "  - " + x.n).join("\n")); process.exitCode = 1; }
}
