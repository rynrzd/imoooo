/** Capture d'écran : node scripts/_shot.mjs <base> <chemin> <sortie.png> [largeur] */
import { writeFileSync } from "node:fs";
import { launch, newPage, sleep } from "./_cdp.mjs";

const [, , base, path, out, width] = process.argv;
const b = await launch();
try {
  const page = await newPage(b);
  await page.setCookie({ name: "nireo_consent", value: "all", url: base, path: "/" });
  await page.resize(Number(width) || 1280, 900);
  await page.goto(base + path);
  await sleep(1200);
  writeFileSync(out, Buffer.from(await page.screenshot(), "base64"));
  console.log("écrit " + out);
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
} finally {
  await b.close();
  await sleep(200);
  process.exit(0);
}
