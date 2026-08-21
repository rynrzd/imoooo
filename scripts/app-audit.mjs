/**
 * AUDIT DE L'ESPACE CONNECTÉ — dans un vrai navigateur, avec une VRAIE session.
 *
 * Usage : node scripts/app-audit.mjs [baseUrl]
 *
 * Crée deux comptes jetables (A avec un patrimoine complet, B vide), ouvre une
 * session navigateur par lien magique, puis parcourt chaque page privée :
 * sémantique, focus clavier, erreurs console, requêtes en échec, débordement
 * sur cinq largeurs, et présence d'un état vide explicite pour le compte neuf.
 *
 * Les deux comptes sont supprimés à la fin, quoi qu'il arrive.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { launch, newPage, reporter, sleep } from "./_cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3126";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const mail = (x) => `audit-ui-${x}-${stamp}@nireo-audit.test`;

/** Pages privées visitées, et ce qu'on attend d'y voir. */
const PRIVATE_PAGES = [
  { path: "/", name: "Tableau de bord" },
  { path: "/logements", name: "Logements" },
  { path: "/locataires", name: "Locataires" },
  { path: "/baux", name: "Baux" },
  { path: "/loyers", name: "Loyers" },
  { path: "/documents", name: "Documents" },
  { path: "/depenses", name: "Dépenses" },
  { path: "/travaux", name: "Travaux" },
  { path: "/photos", name: "Photos" },
  { path: "/statistiques", name: "Statistiques" },
  { path: "/pilotage", name: "Pilotage" },
  { path: "/abonnement", name: "Abonnement" },
  { path: "/profil", name: "Profil" },
  { path: "/profil/informations", name: "Profil · informations" },
  { path: "/profil/securite", name: "Profil · sécurité" },
  { path: "/profil/preferences", name: "Profil · préférences" },
  { path: "/profil/donnees", name: "Profil · données" },
  { path: "/profil/aide", name: "Profil · aide" },
];

const WIDTHS = [
  { w: 320, label: "petit mobile" },
  { w: 390, label: "mobile" },
  { w: 768, label: "tablette" },
  { w: 1280, label: "desktop" },
  { w: 1920, label: "grand écran" },
];

const PAGE_AUDIT = String.raw`(() => {
  const de = document.documentElement;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const name = (el) =>
    (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") ||
     el.querySelector("img")?.alt || "").replace(/\s+/g, " ").trim();
  const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis);
  let prev = 0, jumps = [];
  for (const h of hs) {
    const lvl = +h.tagName[1];
    if (prev && lvl > prev + 1) jumps.push("h" + prev + "->h" + lvl);
    prev = lvl;
  }
  return JSON.stringify({
    overflow: de.scrollWidth - de.clientWidth,
    main: document.querySelectorAll("main").length,
    h1: hs.filter((h) => h.tagName === "H1").map((h) => h.innerText.trim().slice(0, 60)),
    jumps,
    text: (document.body.innerText || "").replace(/\s+/g, " ").trim(),
    nameless: [...document.querySelectorAll("a[href],button")].filter(vis).filter((el) => !name(el))
      .map((el) => el.tagName + "." + String(el.className).slice(0, 50)).slice(0, 8),
    unlabeled: [...document.querySelectorAll("input,select,textarea")].filter(vis)
      .filter((el) => !["hidden", "submit", "button"].includes(el.type))
      // Retirés de l'arbre d'accessibilité (input caché d'un Switch base-ui,
      // par ex.) : ils ne sont ni lus ni atteignables, donc pas un défaut.
      .filter((el) => el.getAttribute("aria-hidden") !== "true" && el.tabIndex >= 0)
      .filter((el) => {
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
        if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return false;
        return !el.closest("label");
      }).map((el) => el.tagName + "#" + (el.id || el.name || "?")).slice(0, 8),
    imgNoAlt: [...document.querySelectorAll("img")].filter(vis)
      .filter((i) => i.getAttribute("alt") === null).length,
    skip: [...document.querySelectorAll('a[href^="#"]')].slice(0, 2)
      .some((a) => /contenu|principal/i.test(a.innerText || a.getAttribute("aria-label") || "")),
    spinners: [...document.querySelectorAll('[class*="animate-spin"],[class*="animate-pulse"]')].filter(vis).length,
  });
})()`;

const FOCUS_PROBE = String.raw`(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return JSON.stringify({ end: true });
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  // Une ombre ENTIÈREMENT transparente ne se voit pas : Tailwind laisse des
  // couches « rgba(0, 0, 0, 0) 0px 0px 0px 0px » en place même sans anneau de
  // focus. Tester « boxShadow !== 'none' » déclarerait donc visible ce qui ne
  // l'est pas — c'est exactement ce qui produisait des verdicts flatteurs.
  const rest = (s.boxShadow || "none")
    .replace(/rgba\(0,\s*0,\s*0,\s*0\)\s*0px\s*0px\s*0px\s*0px/g, "")
    .replace(/[\s,]/g, "");
  const opaqueShadow = rest !== "" && rest !== "none";
  const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return JSON.stringify({
    visible: outline || opaqueShadow,
    hidden: r.width < 1 || r.height < 1,
    sel: el.tagName.toLowerCase() + (cls ? "." + cls : ""),
    label: (el.getAttribute("aria-label") || el.innerText || el.value || "").replace(/\s+/g, " ").trim().slice(0, 34),
    shadow: (s.boxShadow || "").slice(0, 90),
  });
})()`;

const r = reporter();
let browser = null;
const created = [];

async function makeUser(tag) {
  const { data, error } = await admin.auth.admin.createUser({
    email: mail(tag),
    password: "Audit-2026!Secure#x",
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  created.push(data.user.id);
  return data.user;
}

/** Ouvre une session NAVIGATEUR (cookies réels) via un lien magique. */
async function signIn(page, email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  await page.goto(`${BASE}/auth/callback?token_hash=${data.properties.hashed_token}&type=email`);
  await sleep(900);
  return page.evaluate("location.pathname + location.search");
}

try {
  const userA = await makeUser("a");
  await makeUser("b"); // compte neuf : sert aux états vides plus bas

  // Patrimoine complet pour A — pour voir les pages PLEINES, pas seulement vides.
  const p = (await admin.from("properties").insert({
    owner_id: userA.id, name: "Appartement Voltaire", address: "12 rue Voltaire",
    postal_code: "75011", city: "Paris", type: "T3", surface: 62, rooms: 3,
    purchase_price: 320000, purchase_date: "2021-06-01", rent: 1180, charges: 90, status: "loue",
  }).select().single()).data;
  const t = (await admin.from("tenants").insert({
    owner_id: userA.id, first_name: "Camille", last_name: "Rousseau",
    email: "camille@audit.test", phone: "0611223344",
  }).select().single()).data;
  const l = (await admin.from("leases").insert({
    owner_id: userA.id, property_id: p.id, tenant_id: t.id,
    entry_date: "2024-03-01", rent: 1180, charges: 90, deposit: 1180,
  }).select().single()).data;
  await admin.from("rent_payments").insert([
    { owner_id: userA.id, lease_id: l.id, month: "2026-06-01", expected: 1270, paid_amount: 1270, paid_date: "2026-06-03", status: "paye" },
    { owner_id: userA.id, lease_id: l.id, month: "2026-07-01", expected: 1270, paid_amount: 1270, paid_date: "2026-07-02", status: "paye" },
    { owner_id: userA.id, lease_id: l.id, month: "2026-08-01", expected: 1270 },
  ]);
  await admin.from("expenses").insert({
    owner_id: userA.id, property_id: p.id, label: "Taxe foncière",
    category: "taxe", amount: 840, date: "2026-05-14",
  });
  await admin.from("documents").insert({
    owner_id: userA.id, property_id: p.id, name: "Bail signé",
    category: "bail", file_path: `${userA.id}/${p.id}/bail.pdf`,
  });
  await admin.from("maintenance_records").insert({
    owner_id: userA.id, property_id: p.id, title: "Remplacement chaudière",
    category: "chauffage", status: "termine", cost: 2400, date: "2026-04-02",
  });
  r.check("Jeu de données de démonstration créé", Boolean(p && t && l));

  browser = await launch();
  const page = await newPage(browser);

  /* ---------------- Compte A : pages pleines ---------------- */
  const landed = await signIn(page, mail("a"));
  r.check("Session navigateur ouverte (compte A)", !String(landed).includes("erreur"), String(landed));

  for (const { path, name } of PRIVATE_PAGES) {
    await page.resize(1280, 900);
    const text = await page.goto(BASE + path);
    const d = JSON.parse(await page.evaluate(PAGE_AUDIT));

    r.check(`${name} — page rendue (pas de redirection vers /connexion)`,
      !text.includes("Retrouvez votre espace"), text.slice(0, 60));
    r.check(`${name} — <main> unique`, d.main === 1, `main=${d.main}`);
    r.check(`${name} — exactement un <h1>`, d.h1.length === 1, d.h1.join(" | ") || "aucun");
    r.check(`${name} — hiérarchie de titres sans saut`, d.jumps.length === 0, d.jumps.join(" "));
    r.check(`${name} — liens/boutons tous nommés`, d.nameless.length === 0, d.nameless.join(" ; "));
    r.check(`${name} — champs tous étiquetés`, d.unlabeled.length === 0, d.unlabeled.join(" ; "));
    r.check(`${name} — images pourvues d'un alt`, d.imgNoAlt === 0, `${d.imgNoAlt} sans alt`);
    r.check(`${name} — lien d'évitement`, d.skip);
    r.check(`${name} — aucune erreur console`, page.state.errors.length === 0,
      page.state.errors.slice(0, 2).join(" | "));
    r.check(`${name} — aucune requête en échec`, page.state.failedRequests.length === 0,
      page.state.failedRequests.slice(0, 2).join(" | "));
    r.check(`${name} — plus aucun indicateur de chargement après stabilisation`,
      d.spinners === 0, `${d.spinners} en rotation`);

    // Focus clavier
    let invisible = [];
    await page.evaluate("window.scrollTo(0,0); if(document.activeElement) document.activeElement.blur();");
    for (let i = 0; i < 16; i++) {
      await page.pressTab();
      const f = JSON.parse(await page.evaluate(FOCUS_PROBE));
      if (f.end) break;
      if (!f.hidden && !f.visible) invisible.push(`${f.sel}${f.label ? ` «${f.label}»` : ""}`);
    }
    r.check(`${name} — focus visible au clavier`, invisible.length === 0,
      [...new Set(invisible)].slice(0, 4).join(" ; "));

    // Cinq largeurs
    const over = [];
    for (const { w, label } of WIDTHS) {
      await page.resize(w, 820);
      await sleep(450);
      const m = JSON.parse(await page.evaluate(PAGE_AUDIT));
      if (m.overflow > 2) over.push(`${label} ${w}px:+${m.overflow}`);
    }
    r.check(`${name} — aucun débordement horizontal (5 largeurs)`, over.length === 0, over.join(" ; "));
  }

  /* ---------------- Compte B : états vides ---------------- */
  await page.resize(1280, 900);
  await signIn(page, mail("b"));
  const EMPTY_PAGES = [
    { path: "/logements", name: "Logements" },
    { path: "/locataires", name: "Locataires" },
    { path: "/baux", name: "Baux" },
    { path: "/loyers", name: "Loyers" },
    { path: "/documents", name: "Documents" },
    { path: "/depenses", name: "Dépenses" },
    { path: "/travaux", name: "Travaux" },
    { path: "/photos", name: "Photos" },
    { path: "/statistiques", name: "Statistiques" },
  ];
  for (const { path, name } of EMPTY_PAGES) {
    await page.goto(BASE + path);
    const d = JSON.parse(await page.evaluate(PAGE_AUDIT));
    // Un état vide utile explique quoi faire : il contient un verbe d'action.
    const guides = /(ajout|créer|créez|commenc|enregistr|importer|déposer|premier|première|aucun|aucune)/i.test(d.text);
    r.check(`${name} (compte neuf) — état vide explicite`, guides && d.text.length > 40,
      d.text.slice(0, 90));
    r.check(`${name} (compte neuf) — aucune erreur console`, page.state.errors.length === 0,
      page.state.errors.slice(0, 2).join(" | "));
  }

  /* ---------------- Ressource inexistante & IDOR d'URL ---------------- */
  const bogus = "00000000-0000-0000-0000-000000000000";
  for (const path of [`/logements/${bogus}`, `/locataires/${bogus}`]) {
    const text = await page.goto(BASE + path);
    const isClean =
      /introuvable|n'existe|inexistant|not found|404|aucun/i.test(text) ||
      (await page.evaluate("location.pathname")) !== path;
    r.check(`Ressource inexistante ${path} — réponse claire, pas d'écran blanc`,
      isClean && text.trim().length > 20, text.slice(0, 80));
  }
  // B tente d'ouvrir le logement de A par son identifiant.
  const stolen = await page.goto(`${BASE}/logements/${p.id}`);
  const denied =
    /introuvable|n'existe|inexistant|not found|404|aucun/i.test(stolen) ||
    !stolen.includes("Voltaire");
  r.check("IDOR d'URL — B n'obtient pas le logement de A", denied, stolen.slice(0, 90));

  /* ---------------- Déconnexion ---------------- */
  await page.goto(`${BASE}/profil`);
  const loggedOut = await page.evaluate(String.raw`(async () => {
    const b = [...document.querySelectorAll("button,a")].find((e) => /déconnexion|déconnecter/i.test(e.innerText || ""));
    if (!b) return "bouton introuvable";
    b.click();
    await new Promise((r) => setTimeout(r, 2500));
    return location.pathname;
  })()`);
  r.check("Déconnexion depuis /profil", typeof loggedOut === "string" && loggedOut !== "bouton introuvable", String(loggedOut));
  await sleep(1200);
  const after = await page.goto(`${BASE}/logements`);
  r.check("Après déconnexion, /logements renvoie vers la connexion",
    after.includes("Retrouvez votre espace") || (await page.evaluate("location.pathname")) === "/connexion",
    (await page.evaluate("location.pathname")));
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
  r.check("Audit mené à son terme", false, String(e?.message ?? e));
} finally {
  for (const id of created) {
    try { await admin.auth.admin.deleteUser(id); } catch { /* déjà parti */ }
  }
  console.log("\nNettoyage : comptes d'audit supprimés.");
  const s = r.summary();
  if (browser) await browser.close();
  await sleep(400);
  process.exit(s.failures.length ? 1 : 0);
}
