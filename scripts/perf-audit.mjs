/**
 * AUDIT PERFORMANCE — ce que le navigateur télécharge et exécute VRAIMENT.
 *
 * Usage : node scripts/perf-audit.mjs [baseUrl]
 *
 * Mesure par page : octets transférés par type, nombre de requêtes, temps
 * jusqu'au premier rendu et jusqu'à l'interactivité, plus grand élément peint,
 * décalage cumulé de mise en page, et requêtes redondantes (même URL demandée
 * plusieurs fois). Aucune extrapolation : tout vient de l'API Performance.
 */
import { launch, newPage, reporter, sleep } from "./_cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3126";
const PATHS = ["/", "/tarifs", "/ressources", "/generateur-quittance-loyer", "/connexion", "/contact"];

/** Seuils : au-delà, on veut une raison. */
const BUDGET = { jsKb: 700, totalKb: 1600, requests: 70, lcpMs: 2500, cls: 0.1 };

const MEASURE = String.raw`(() => {
  const nav = performance.getEntriesByType("navigation")[0] || {};
  const res = performance.getEntriesByType("resource");
  const by = {};
  let total = 0;
  const seen = new Map();
  for (const r of res) {
    const kind = r.initiatorType === "script" || /\.js(\?|$)/.test(r.name) ? "js"
      : r.initiatorType === "css" || /\.css(\?|$)/.test(r.name) ? "css"
      : r.initiatorType === "img" || /\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/.test(r.name) ? "img"
      : /\.(woff2?|ttf|otf)(\?|$)/.test(r.name) ? "font"
      : "autre";
    const size = r.transferSize || r.encodedBodySize || 0;
    by[kind] = (by[kind] || 0) + size;
    total += size;
    seen.set(r.name, (seen.get(r.name) || 0) + 1);
  }
  const lcp = performance.getEntriesByType("largest-contentful-paint").pop();
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  return JSON.stringify({
    requests: res.length,
    kb: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round(v / 1024)])),
    totalKb: Math.round(total / 1024),
    fcpMs: fcp ? Math.round(fcp.startTime) : null,
    lcpMs: lcp ? Math.round(lcp.startTime) : null,
    domReadyMs: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
    cls: Math.round((window.__cls || 0) * 1000) / 1000,
    duplicates: [...seen.entries()].filter(([, n]) => n > 1)
      .map(([u, n]) => n + "x " + u.split("/").pop().slice(0, 50)).slice(0, 6),
  });
})()`;

const b = await launch();
const r = reporter();
try {
  const page = await newPage(b);
  await page.setCookie({ name: "nireo_consent", value: "all", url: BASE, path: "/" });
  await page.resize(1280, 900);

  for (const path of PATHS) {
    // Observer le décalage de mise en page dès le tout début du document.
    await page.rpc(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source:
          "window.__cls=0;new PerformanceObserver((l)=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value;}}).observe({type:'layout-shift',buffered:true});",
      },
      page.sessionId
    );
    await page.goto(BASE + path);
    await sleep(1200);
    const m = JSON.parse(await page.evaluate(MEASURE));

    console.log(`\n───────── ${path} ─────────`);
    console.log(
      `  ${m.requests} requêtes · ${m.totalKb} Ko au total ` +
        `(js ${m.kb.js ?? 0} · css ${m.kb.css ?? 0} · img ${m.kb.img ?? 0} · police ${m.kb.font ?? 0})`
    );
    console.log(`  FCP ${m.fcpMs ?? "?"} ms · LCP ${m.lcpMs ?? "?"} ms · DOM prêt ${m.domReadyMs ?? "?"} ms · CLS ${m.cls}`);

    r.check(`${path} — JS ≤ ${BUDGET.jsKb} Ko`, (m.kb.js ?? 0) <= BUDGET.jsKb, `${m.kb.js ?? 0} Ko`);
    r.check(`${path} — poids total ≤ ${BUDGET.totalKb} Ko`, m.totalKb <= BUDGET.totalKb, `${m.totalKb} Ko`);
    r.check(`${path} — ≤ ${BUDGET.requests} requêtes`, m.requests <= BUDGET.requests, `${m.requests}`);
    r.check(`${path} — LCP ≤ ${BUDGET.lcpMs} ms`, (m.lcpMs ?? 0) <= BUDGET.lcpMs, `${m.lcpMs} ms`);
    r.check(`${path} — CLS ≤ ${BUDGET.cls}`, m.cls <= BUDGET.cls, `${m.cls}`);
    r.check(`${path} — aucune ressource demandée deux fois`, m.duplicates.length === 0, m.duplicates.join(" ; "));
  }
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
  r.check("Audit mené à son terme", false, String(e?.message ?? e));
} finally {
  const s = r.summary();
  await b.close();
  await sleep(300);
  process.exit(s.failures.length ? 1 : 0);
}
