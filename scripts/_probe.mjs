/** Sonde ponctuelle : exécute une expression sur une page et imprime le résultat. */
import { launch, newPage, sleep } from "./_cdp.mjs";

const [, , base, path, exprFile, width] = process.argv;
const expr = (await import("node:fs")).readFileSync(exprFile, "utf8");
const b = await launch();
try {
  const page = await newPage(b);
  await page.setCookie({ name: "nireo_consent", value: "all", url: base, path: "/" });
  await page.resize(Number(width) || 1280, 900);
  await page.goto(base + path);
  await sleep(600);
  console.log(await page.evaluate(expr));
  if (page.state.errors.length) console.log("\nERREURS CONSOLE:\n" + page.state.errors.join("\n"));
  if (page.state.failedRequests.length) console.log("\nREQUÊTES EN ÉCHEC:\n" + page.state.failedRequests.join("\n"));
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
} finally {
  await b.close();
  await sleep(200);
  process.exit(0);
}
