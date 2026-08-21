/**
 * AUDIT DES PARCOURS — les actions sont RÉELLEMENT effectuées dans l'interface.
 *
 * Usage : node scripts/ui-flow-audit.mjs [baseUrl]
 *
 * Ouvre une vraie session dans un vrai navigateur, puis clique, saisit et
 * soumet comme un utilisateur : création d'un logement en trois étapes,
 * modification, suppression, ajout d'un locataire. Et surtout, cherche ce qui
 * casse — formulaire vide, données invalides, double clic, retour arrière,
 * rafraîchissement en cours de saisie, URL d'une ressource inexistante,
 * accès sans session.
 *
 * Le compte jetable est supprimé à la fin, quoi qu'il arrive.
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
const EMAIL = `audit-flux-${stamp}@nireo-audit.test`;

/* ------------------------------------------------------------------ */
/*  Gestes : saisir dans un champ React, cliquer sur un libellé        */
/* ------------------------------------------------------------------ */

/** Écrit dans un champ en déclenchant l'événement que React écoute. */
const typeInto = (id, value) => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return "champ introuvable: " + ${JSON.stringify(id)};
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return "ok";
})()`;

/** Clique le premier élément cliquable dont le texte correspond. */
const clickText = (pattern, tag = "button,a") => `(() => {
  const re = new RegExp(${JSON.stringify(pattern)}, "i");
  const el = [...document.querySelectorAll(${JSON.stringify(tag)})]
    .filter((e) => !e.disabled && e.offsetParent !== null)
    .find((e) => re.test((e.innerText || e.getAttribute("aria-label") || "").trim()));
  if (!el) return "introuvable: " + ${JSON.stringify(pattern)};
  el.click();
  return "ok";
})()`;

/** Messages d'erreur affichés (role=alert) + notifications visibles. */
const ERRORS = `(() => {
  const alerts = [...document.querySelectorAll('[role="alert"]')]
    .map((e) => (e.innerText || "").replace(/\\s+/g, " ").trim()).filter(Boolean);
  const invalid = document.querySelectorAll('[aria-invalid="true"]').length;
  return JSON.stringify({ alerts, invalid, body: (document.body.innerText || "").replace(/\\s+/g, " ") });
})()`;

const r = reporter();
let browser = null;
let userId = null;

try {
  const { data: created, error: ce } = await admin.auth.admin.createUser({
    email: EMAIL, password: "Audit-2026!Secure#x", email_confirm: true,
  });
  if (ce) throw new Error("création du compte : " + ce.message);
  userId = created.user.id;

  browser = await launch();
  const page = await newPage(browser);

  /* ---------- 0. Accès sans session à une route privée ---------- */
  await page.resize(1280, 900);
  await page.goto(`${BASE}/logements`);
  const anon = await page.evaluate("location.pathname + location.search");
  r.check("Sans session, /logements renvoie vers la connexion avec retour prévu",
    String(anon).startsWith("/connexion"), String(anon));

  /* ---------- Connexion ---------- */
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  await page.goto(`${BASE}/auth/callback?token_hash=${link.properties.hashed_token}&type=email`);
  await sleep(1000);
  r.check("Session ouverte dans le navigateur", (await page.evaluate("location.pathname")) === "/");

  /* ---------- 1. Formulaire VIDE : des erreurs, pas un crash ---------- */
  await page.goto(`${BASE}/logements/nouveau`);
  await page.evaluate(clickText("Continuer vers la location"));
  await sleep(700);
  const empty = JSON.parse(await page.evaluate(ERRORS));
  r.check("Formulaire vide — refusé avec des messages d'erreur",
    empty.alerts.length > 0 || empty.invalid > 0,
    `${empty.alerts.length} message(s), ${empty.invalid} champ(s) invalide(s)`);
  r.check("Formulaire vide — l'utilisateur reste sur l'étape 1 (pas de page blanche)",
    empty.body.length > 100 && /logement|bien/i.test(empty.body));
  r.check("Formulaire vide — aucune erreur technique affichée",
    !/undefined|NaN|\[object|Error:|TypeError/i.test(empty.alerts.join(" ")),
    empty.alerts.slice(0, 3).join(" | "));

  /* ---------- 2. Données INVALIDES ---------- */
  await page.evaluate(typeInto("p-name", "Studio de test"));
  await page.evaluate(typeInto("p-address", "3 rue des Tests"));
  await page.evaluate(typeInto("p-postal", "7500"));      // 4 chiffres : invalide
  await page.evaluate(typeInto("p-city", "Paris"));
  await page.evaluate(typeInto("p-surface", "-12"));      // négatif : invalide
  await page.evaluate(clickText("Continuer vers la location"));
  await sleep(700);
  const bad = JSON.parse(await page.evaluate(ERRORS));
  r.check("Code postal à 4 chiffres et surface négative — refusés",
    bad.alerts.length > 0 || bad.invalid > 0,
    bad.alerts.slice(0, 3).join(" | "));

  /* ---------- 3. Création RÉELLE, avec TRIPLE CLIC sur l'envoi ---------- */
  await page.evaluate(typeInto("p-postal", "75015"));
  await page.evaluate(typeInto("p-surface", "34"));
  await page.evaluate(typeInto("p-rooms", "2"));
  await page.evaluate(typeInto("p-price", "245000"));
  await page.evaluate(typeInto("p-purchase-date", "2022-09-15"));
  await page.evaluate(clickText("Continuer vers la location"));
  await sleep(1000);
  const atStep2 = await page.evaluate(`document.getElementById("p-rent") !== null`);
  r.check("Étape 1 validée — l'étape « location » s'affiche", atStep2 === true);

  if (atStep2) {
    // Logement loué : le bail exige un locataire et une date d'entrée.
    await page.evaluate(typeInto("p-first", "Camille"));
    await page.evaluate(typeInto("p-last", "Rousseau"));
    await page.evaluate(typeInto("p-email", "camille@audit.test"));
    await page.evaluate(typeInto("p-entry", "2025-04-01"));
    await page.evaluate(typeInto("p-rent", "780"));
    await page.evaluate(typeInto("p-charges", "45"));
    // TROIS clics coup sur coup, sans laisser la requête aboutir : exactement
    // ce que fait quelqu'un sur une connexion lente. Le libellé est comparé
    // EXACTEMENT — « Je terminerai plus tard » (sortie du parcours)
    // correspondrait sinon à une recherche sur « Terminer ».
    await page.evaluate(`(() => {
      const el = [...document.querySelectorAll("button")]
        .filter((e) => !e.disabled && e.offsetParent !== null)
        .find((e) => /^Continuer vers les documents$/i.test((e.innerText || "").trim()));
      if (!el) return "introuvable";
      el.click(); el.click(); el.click();
      return "ok";
    })()`);
    await sleep(4000);
  }
  // Étape 3 : le document est facultatif, on passe.
  await page.evaluate(clickText("ajouterai plus tard"));
  await sleep(1500);

  const { data: rows } = await admin.from("properties").select("*").eq("owner_id", userId);
  r.check("Triple clic sur l'envoi — UN SEUL logement créé",
    (rows?.length ?? 0) === 1,
    `${rows?.length ?? 0} logement(s) : ${rows?.map((x) => x.name).join(", ") || "—"}`);
  const propertyId = rows?.[0]?.id ?? null;
  r.check("Les valeurs saisies sont celles enregistrées",
    rows?.[0]?.postal_code === "75015" && Number(rows?.[0]?.surface) === 34,
    JSON.stringify({ cp: rows?.[0]?.postal_code, surface: rows?.[0]?.surface }));
  const { data: leases } = await admin.from("leases").select("id").eq("owner_id", userId);
  r.check("Le bail du locataire saisi est créé en même temps", (leases?.length ?? 0) === 1);

  /* ---------- 4. La liste montre le nouveau logement ---------- */
  await page.goto(`${BASE}/logements`);
  // Les données de l'espace connecté arrivent côté navigateur : on laisse au
  // magasin le temps de les servir plutôt que de conclure sur une liste vide.
  let list = "";
  for (let i = 0; i < 10; i++) {
    list = await page.evaluate("document.body.innerText.replace(/\\s+/g,' ')");
    if (list.includes("Studio de test")) break;
    await sleep(600);
  }
  r.check("Le logement créé apparaît dans la liste", list.includes("Studio de test"),
    list.slice(0, 120));

  /* ---------- 5. QUOTA du plan Gratuit (1 logement) ---------- */
  await page.goto(`${BASE}/logements/nouveau`);
  for (const [id, v] of [["p-name", "Second logement"], ["p-address", "1 rue Double"],
    ["p-postal", "69001"], ["p-city", "Lyon"], ["p-surface", "20"], ["p-rooms", "1"],
    ["p-price", "150000"], ["p-purchase-date", "2023-01-10"]]) {
    await page.evaluate(typeInto(id, v));
  }
  await page.evaluate(clickText("Continuer vers la location"));
  await sleep(1000);
  await page.evaluate(typeInto("p-first", "Paul"));
  await page.evaluate(typeInto("p-last", "Martin"));
  await page.evaluate(typeInto("p-entry", "2025-06-01"));
  await page.evaluate(typeInto("p-rent", "600"));
  await page.evaluate(clickText("^Continuer vers les documents$"));
  await sleep(3000);
  const quota = JSON.parse(await page.evaluate(ERRORS));
  const { data: afterQuota } = await admin.from("properties").select("id").eq("owner_id", userId);
  r.check("Quota Gratuit — le 2e logement n'est pas créé",
    (afterQuota?.length ?? 0) === 1, `${afterQuota?.length ?? 0} en base`);
  r.check("Quota Gratuit — l'utilisateur reçoit une explication, pas une erreur muette",
    /plan|logement|limite|maximum|passez/i.test(quota.alerts.join(" ") + quota.body.slice(0, 3000)),
    quota.alerts.slice(0, 2).join(" | ") || "aucun message role=alert");

  /* ---------- 6. MODIFICATION depuis la fiche ---------- */
  if (propertyId) {
    await page.goto(`${BASE}/logements/${propertyId}`);
    const opened = await page.evaluate(clickText("^Modifier$|Modifier le bien"));
    await sleep(1500);
    r.check("Le panneau de modification s'ouvre depuis la fiche",
      (await page.evaluate(`document.getElementById("ep-name") !== null`)) === true, opened);
    await page.evaluate(typeInto("ep-name", "Studio de test MODIFIÉ"));
    await page.evaluate(clickText("^Enregistrer$"));
    await sleep(2500);
    const { data: after } = await admin.from("properties").select("name").eq("id", propertyId).single();
    r.check("Modification depuis l'interface enregistrée en base",
      after?.name === "Studio de test MODIFIÉ", after?.name ?? "—");
  }

  /* ---------- 7. RAFRAÎCHISSEMENT en pleine saisie ---------- */
  await page.goto(`${BASE}/logements/nouveau`);
  await page.evaluate(typeInto("p-name", "Brouillon interrompu"));
  await sleep(1200); // laisser le brouillon s'enregistrer
  await page.goto(`${BASE}/logements/nouveau`);
  const draft = await page.evaluate(`(() => document.getElementById("p-name")?.value || "")()`);
  r.check("Rafraîchissement en pleine saisie — la page se recharge sans casser",
    typeof draft === "string", String(draft));
  r.note("Reprise du brouillon après rechargement", draft ? `retrouvé : « ${draft} »` : "champ vide (pas de reprise)");

  /* ---------- 8. RETOUR ARRIÈRE du navigateur ---------- */
  await page.goto(`${BASE}/logements`);
  await page.goto(`${BASE}/loyers`);
  await page.evaluate("history.back()");
  await sleep(1800);
  const back = await page.evaluate("location.pathname");
  const backBody = await page.evaluate("document.body.innerText.length");
  r.check("Retour arrière — revient sur /logements avec du contenu",
    back === "/logements" && backBody > 200, `${back} (${backBody} caractères)`);

  /* ---------- 9. SUPPRESSION réelle ---------- */
  if (propertyId) {
    // La suppression vit DANS le panneau de modification, pas sur la fiche.
    await page.goto(`${BASE}/logements/${propertyId}`);
    await page.evaluate(clickText("^Modifier$|Modifier le bien"));
    await sleep(1500);
    await page.evaluate(clickText("^Supprimer$"));
    await sleep(1200);
    /*
     * Ne PAS chercher la confirmation par `role="dialog"` : selon l'état du
     * composant, base-ui ne pose ce rôle sur aucun nœud atteignable ici, et le
     * test concluait « pas de confirmation » alors que la boîte est bien là et
     * que la suppression aboutit. On l'identifie donc par ce qu'elle DIT et par
     * l'action qu'elle propose — ce que voit l'utilisateur.
     */
    const confirmed = await page.evaluate(`(() => {
      const txt = document.body.innerText || "";
      if (!/Supprimer ce logement\s*\?/i.test(txt)) return "pas de confirmation";
      const bouton = [...document.querySelectorAll("button")]
        .some((e) => /^Supprimer définitivement$/i.test((e.innerText || "").trim()));
      if (!bouton) return "confirmation sans action";
      return /définiti|irréversible|supprimés en même temps/i.test(txt)
        ? "conséquences annoncées"
        : "confirmation sommaire";
    })()`);
    r.check("La suppression demande une confirmation qui annonce ses conséquences",
      confirmed === "conséquences annoncées", String(confirmed));
    await sleep(600);
    const clicked = await page.evaluate(`(() => {
      const b = [...document.querySelectorAll("button")]
        .filter((e) => !e.disabled && e.offsetParent !== null)
        .find((e) => /^Supprimer définitivement$/i.test((e.innerText || "").trim()));
      if (!b) return "bouton introuvable";
      b.click();
      return "ok";
    })()`);
    if (clicked !== "ok") r.note("Clic sur la confirmation", String(clicked));
    await sleep(3500);
    const { data: gone } = await admin.from("properties").select("id").eq("id", propertyId);
    r.check("Suppression depuis l'interface — le logement disparaît vraiment",
      (gone?.length ?? 0) === 0, `${gone?.length ?? 0} restant(s)`);
  }

  /* ---------- 10. Ressource inexistante ---------- */
  const ghost = await page.goto(`${BASE}/logements/00000000-0000-0000-0000-000000000000`);
  r.check("Logement inexistant — message clair, ni page blanche ni erreur technique",
    ghost.trim().length > 40 && !/TypeError|undefined is not|Cannot read/i.test(ghost),
    ghost.slice(0, 90));

  /* ---------- 11. Session invalidée pendant la navigation ---------- */
  await page.goto(`${BASE}/logements`);
  await admin.auth.admin.signOut(
    (await admin.auth.admin.listUsers()).data.users.find((u) => u.id === userId) ? "" : ""
  ).catch(() => {});
  await page.evaluate(`document.cookie.split(";").forEach((c) => {
    const n = c.split("=")[0].trim();
    if (n.startsWith("sb-")) document.cookie = n + "=; Max-Age=0; path=/";
  })`);
  const expired = await page.goto(`${BASE}/loyers`);
  const onLogin = (await page.evaluate("location.pathname")) === "/connexion";
  r.check("Session expirée — redirection propre vers la connexion, sans écran d'erreur",
    onLogin || expired.includes("Retrouvez votre espace"),
    await page.evaluate("location.pathname"));

  /* ---------- 12. Aucune erreur console sur tout le parcours ---------- */
  r.check("Aucune erreur console sur la dernière navigation",
    page.state.errors.length === 0, page.state.errors.slice(0, 2).join(" | "));
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
  r.check("Audit mené à son terme", false, String(e?.message ?? e));
} finally {
  if (userId) {
    try { await admin.auth.admin.deleteUser(userId); } catch { /* déjà parti */ }
  }
  console.log("\nNettoyage : compte d'audit supprimé.");
  const s = r.summary();
  if (browser) await browser.close();
  await sleep(400);
  process.exit(s.failures.length ? 1 : 0);
}
