/**
 * AUDIT D'ÉLÉVATION DE PRIVILÈGES — un utilisateur NORMAL attaque le serveur.
 *
 * Usage : node scripts/privilege-audit.mjs [baseUrl]
 *
 * Ouvre une vraie session (compte jetable, non administrateur) dans un vrai
 * navigateur, puis envoie les requêtes DEPUIS la page : les cookies de session
 * partent donc exactement comme pour un attaquant authentifié. Aucune
 * hypothèse sur l'interface — on parle directement au serveur.
 *
 * Rien de destructif : les écritures visent des identifiants inexistants ou
 * les données du compte jetable, jamais des données réelles.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { launch, newPage, reporter, sleep } from "./_cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3133";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const EMAIL = `audit-priv-${Date.now()}@nireo-audit.test`;
const BOGUS = "00000000-0000-0000-0000-000000000000";

/** Routes admin : un compte normal ne doit JAMAIS obtenir 2xx. */
const ADMIN_ROUTES = [
  ["GET", "/api/admin/analytics", null],
  ["GET", "/api/admin/marketing/qr?ref=TEST", null],
  ["GET", "/api/admin/marketing/commissions/export", null],
  ["POST", "/api/admin/marketing/commissions", { action: "approve", id: BOGUS }],
  ["POST", "/api/admin/marketing/partners", { action: "create", name: "AUDIT", slug: "audit-x" }],
  ["POST", "/api/admin/marketing/payouts", { action: "create", partner_id: BOGUS, amount: 1 }],
  ["POST", "/api/admin/subscriptions", { action: "suspend", user_id: BOGUS }],
];

/*
 * `/api/admin/session` est volontairement ABSENTE de la liste ci-dessus : c'est
 * la porte d'entrée et de sortie de l'espace administrateur, elle DOIT être
 * joignable sans être déjà administrateur — sinon personne ne pourrait jamais
 * se connecter. Ce qu'on exige d'elle est différent : qu'elle n'accorde jamais
 * les droits. C'est testé séparément plus bas.
 */

/** Tâches planifiées : sans le secret, elles ne doivent pas s'exécuter. */
const CRON_ROUTES = [
  "/api/cron/rent-reminders",
  "/api/cron/monthly-reports",
  "/api/cron/landing-optimizer",
  "/api/cron/nireo-id-checkups",
];

/** Envoie une requête DEPUIS la page : les cookies de session sont joints. */
const call = (method, path, body) => `(async () => {
  try {
    const res = await fetch(${JSON.stringify(path)}, {
      method: ${JSON.stringify(method)},
      headers: ${body ? '{ "Content-Type": "application/json" }' : "{}"},
      ${body ? `body: ${JSON.stringify(JSON.stringify(body))},` : ""}
      credentials: "include",
    });
    const text = (await res.text()).slice(0, 160);
    return JSON.stringify({ status: res.status, text });
  } catch (e) {
    return JSON.stringify({ status: 0, text: String(e).slice(0, 120) });
  }
})()`;

const r = reporter();
let browser = null;
let userId = null;

try {
  const { data: made, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: "Audit-2026!Secure#x", email_confirm: true,
  });
  if (error) throw new Error("création du compte : " + error.message);
  userId = made.user.id;

  browser = await launch();
  const page = await newPage(browser);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  await page.goto(`${BASE}/auth/callback?token_hash=${link.properties.hashed_token}&type=email`);
  await sleep(1000);
  r.check("Session d'un utilisateur NON administrateur ouverte",
    (await page.evaluate("location.pathname")) === "/");

  /* ---------- 1. ROUTES API ADMIN ---------- */
  console.log("\n───────── Routes API administrateur ─────────");
  for (const [method, path, body] of ADMIN_ROUTES) {
    const res = JSON.parse(await page.evaluate(call(method, path, body)));
    const refused = res.status === 401 || res.status === 403 || res.status === 404;
    r.check(`${method} ${path} refusé à un non-admin`, refused,
      `HTTP ${res.status} ${refused ? "" : "— " + res.text}`);
  }

  /* ---------- 1 bis. LA PORTE D'ENTRÉE ADMIN N'OUVRE RIEN ---------- */
  console.log("\n───────── Connexion administrateur ─────────");
  for (const [label, body] of [
    ["corps vide", {}],
    ["identifiants bidon", { email: "inconnu@nireo-audit.test", password: "x" }],
    ["rôle réclamé dans le corps", { email: EMAIL, password: "x", role: "owner", is_admin: true }],
  ]) {
    const res = JSON.parse(await page.evaluate(call("POST", "/api/admin/session", body)));
    r.check(`POST /api/admin/session (${label}) n'accorde aucun droit`,
      res.status !== 200, `HTTP ${res.status} ${res.status === 200 ? res.text : ""}`);
  }
  // La déconnexion doit rester ouverte — mais ne doit rien accorder non plus.
  const out = JSON.parse(await page.evaluate(call("DELETE", "/api/admin/session", null)));
  r.check("DELETE /api/admin/session déconnecte sans élever les droits",
    out.status === 200 && !/role|admin_id|token/i.test(out.text), `HTTP ${out.status} ${out.text}`);
  // Et après ce passage, l'espace admin reste fermé.
  const after = JSON.parse(await page.evaluate(call("GET", "/api/admin/analytics", null)));
  r.check("Après appel de la route de session, /admin reste refusé", after.status === 403 || after.status === 401,
    `HTTP ${after.status}`);

  /* ---------- 2. PAGES ADMIN ---------- */
  console.log("\n───────── Pages /admin ─────────");
  for (const path of ["/admin", "/admin/utilisateurs", "/admin/abonnements", "/admin/transactions", "/admin/parametres"]) {
    await page.goto(BASE + path);
    const landed = await page.evaluate("location.pathname");
    const body = await page.evaluate("document.body.innerText.slice(0, 200)");
    const escaped = landed !== path;
    r.check(`${path} — un non-admin n'y accède pas`, escaped, `atterri sur ${landed}`);
    if (!escaped) r.note(`  contenu servi`, String(body).replace(/\s+/g, " ").slice(0, 120));
  }

  /* ---------- 3. TÂCHES PLANIFIÉES SANS SECRET ---------- */
  console.log("\n───────── Tâches planifiées (sans CRON_SECRET) ─────────");
  await page.goto(BASE + "/");
  for (const path of CRON_ROUTES) {
    const res = JSON.parse(await page.evaluate(call("POST", path, {})));
    const refused = res.status === 401 || res.status === 403 || res.status === 404;
    r.check(`POST ${path} refusé sans secret`, refused, `HTTP ${res.status}`);
  }

  /* ---------- 4. AUTO-PROMOTION EN BASE ---------- */
  console.log("\n───────── Élévation de privilèges en base ─────────");
  /*
   * On parle à PostgREST DIRECTEMENT, avec le jeton de la session — c'est
   * exactement ce que ferait un attaquant qui a un compte : il n'a aucune
   * raison de passer par l'interface, et la RLS est la seule chose qui
   * l'arrête à ce niveau.
   */
  const token = await page.evaluate(`(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.includes("auth-token")) {
        try { const v = JSON.parse(localStorage.getItem(k)); if (v?.access_token) return v.access_token; } catch {}
      }
    }
    return null;
  })()`);
  r.note("Jeton d'accès lisible en localStorage", token ? "OUI (stockage navigateur)" : "non — session en cookies HttpOnly uniquement");

  const rest = async (method, path, body) => {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let out = null;
    try { out = await res.json(); } catch { /* vide */ }
    return { status: res.status, out };
  };

  if (token) {
    const promote = await rest("POST", "admin_users", { user_id: userId, role: "owner", is_active: true });
    r.check("Impossible de s'inscrire soi-même dans admin_users",
      promote.status >= 400, `HTTP ${promote.status} ${JSON.stringify(promote.out).slice(0, 90)}`);

    const listAdmins = await rest("GET", "admin_users?select=*");
    const leaked = Array.isArray(listAdmins.out) && listAdmins.out.length > 0;
    r.check("La liste des administrateurs n'est pas lisible", !leaked,
      `HTTP ${listAdmins.status} ${leaked ? listAdmins.out.length + " ligne(s) EXPOSÉE(S)" : ""}`);

    const setPlan = await rest("PATCH", `profiles?id=eq.${userId}`, { plan: "business" });
    r.check("Impossible de s'attribuer un plan payant (profiles.plan)",
      setPlan.status >= 400 || !Array.isArray(setPlan.out) || setPlan.out.length === 0,
      `HTTP ${setPlan.status} ${JSON.stringify(setPlan.out).slice(0, 90)}`);

    const setSub = await rest("POST", "subscriptions", { user_id: userId, plan: "business", status: "active" });
    r.check("Impossible de se créer un abonnement actif",
      setSub.status >= 400, `HTTP ${setSub.status} ${JSON.stringify(setSub.out).slice(0, 90)}`);

    const readOthers = await rest("GET", "profiles?select=id,email&limit=5");
    const others = Array.isArray(readOthers.out) ? readOthers.out.filter((p) => p.id !== userId) : [];
    r.check("Aucun profil d'un autre compte n'est lisible", others.length === 0,
      `${others.length} profil(s) exposé(s)`);
  } else {
    r.note("Tests PostgREST directs ignorés", "aucun jeton d'accès récupérable côté navigateur");
  }
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
  r.check("Audit mené à son terme", false, String(e?.message ?? e));
} finally {
  if (userId) { try { await admin.auth.admin.deleteUser(userId); } catch { /* déjà parti */ } }
  console.log("\nNettoyage : compte d'audit supprimé.");
  const s = r.summary();
  if (browser) await browser.close();
  await sleep(300);
  process.exit(s.failures.length ? 1 : 0);
}
