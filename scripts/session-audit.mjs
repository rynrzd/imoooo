/**
 * AUDIT DES SESSIONS ET DES JETONS — ce qui survit à quoi.
 *
 * Usage : node scripts/session-audit.mjs
 *
 * Un jeton d'accès Supabase est un JWT : il est valide TANT QU'IL N'EST PAS
 * EXPIRÉ, indépendamment de ce qui arrive au compte. Ce script mesure ce qui
 * se passe RÉELLEMENT après une déconnexion, un changement de mot de passe et
 * une suppression de compte — au lieu de le supposer.
 *
 * Comptes jetables, supprimés à la fin.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const R = [];
const check = (n, ok, d = "") => {
  R.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};
const note = (n, d = "") => console.log(`INFO  ${n}${d ? ` — ${d}` : ""}`);

const stamp = Date.now();
const mail = (x) => `audit-sess-${x}-${stamp}@nireo-audit.test`;
const PASSWORD = "Audit-2026!Secure#x";
const created = [];

/** Ouvre une session réelle et renvoie le jeton d'accès brut. */
async function openSession(email) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error("generateLink: " + error.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error: e2 } = await c.auth.verifyOtp({
    token_hash: link.properties.hashed_token, type: "email",
  });
  if (e2) throw new Error("verifyOtp: " + e2.message);
  return { client: c, token: data.session.access_token, refresh: data.session.refresh_token, userId: data.user.id };
}

/** Le jeton donne-t-il encore accès aux données ? (PostgREST, sans le SDK) */
async function tokenWorks(token) {
  const res = await fetch(`${URL_}/rest/v1/properties?select=id&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  return { ok: res.status === 200, status: res.status };
}

/** Le jeton de rafraîchissement permet-il d'obtenir un NOUVEAU jeton ? */
async function refreshWorks(refresh) {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  return { ok: res.status === 200, status: res.status };
}

try {
  /* ---------------- 1. DÉCONNEXION ---------------- */
  console.log("───────── Après une déconnexion ─────────");
  const { data: uA } = await admin.auth.admin.createUser({
    email: mail("a"), password: PASSWORD, email_confirm: true,
  });
  created.push(uA.user.id);
  const a = await openSession(mail("a"));
  check("Le jeton fonctionne avant la déconnexion", (await tokenWorks(a.token)).ok);

  await a.client.auth.signOut();
  const afterOut = await tokenWorks(a.token);
  const refreshAfterOut = await refreshWorks(a.refresh);
  note("Jeton d'ACCÈS après déconnexion",
    afterOut.ok ? "ENCORE VALIDE (JWT non révocable avant expiration)" : `refusé (HTTP ${afterOut.status})`);
  check("Le jeton de RAFRAÎCHISSEMENT est révoqué par la déconnexion",
    !refreshAfterOut.ok, `HTTP ${refreshAfterOut.status}`);

  /* ---------------- 2. CHANGEMENT DE MOT DE PASSE ---------------- */
  console.log("\n───────── Après un changement de mot de passe ─────────");
  const { data: uB } = await admin.auth.admin.createUser({
    email: mail("b"), password: PASSWORD, email_confirm: true,
  });
  created.push(uB.user.id);
  const b1 = await openSession(mail("b"));
  const b2 = await openSession(mail("b")); // seconde session, « autre appareil »
  check("Deux sessions simultanées ouvertes", (await tokenWorks(b1.token)).ok && (await tokenWorks(b2.token)).ok);

  await admin.auth.admin.updateUserById(uB.user.id, { password: "Nouveau-2026!Secure#y" });
  await new Promise((r) => setTimeout(r, 1500));
  const b1Access = await tokenWorks(b1.token);
  const b1Refresh = await refreshWorks(b1.refresh);
  note("Jeton d'ACCÈS de l'autre appareil après changement de mot de passe",
    b1Access.ok ? "ENCORE VALIDE jusqu'à expiration" : `refusé (HTTP ${b1Access.status})`);
  check("Le RAFRAÎCHISSEMENT de l'autre appareil est révoqué",
    !b1Refresh.ok, `HTTP ${b1Refresh.status}`);

  /* ---------------- 3. SUPPRESSION DE COMPTE ---------------- */
  console.log("\n───────── Après une suppression de compte ─────────");
  const { data: uC } = await admin.auth.admin.createUser({
    email: mail("c"), password: PASSWORD, email_confirm: true,
  });
  const c = await openSession(mail("c"));
  check("Le jeton fonctionne avant la suppression", (await tokenWorks(c.token)).ok);
  await admin.auth.admin.deleteUser(uC.user.id);
  await new Promise((r) => setTimeout(r, 1500));
  const cAccess = await tokenWorks(c.token);
  const cRefresh = await refreshWorks(c.refresh);
  check("Un compte supprimé ne peut plus rafraîchir sa session", !cRefresh.ok, `HTTP ${cRefresh.status}`);
  note("Jeton d'ACCÈS d'un compte supprimé",
    cAccess.ok ? "ENCORE ACCEPTÉ jusqu'à expiration" : `refusé (HTTP ${cAccess.status})`);

  /* ---------------- 4. DURÉE DE VIE DES JETONS ---------------- */
  console.log("\n───────── Durée de vie ─────────");
  const payload = JSON.parse(Buffer.from(a.token.split(".")[1], "base64").toString());
  const lifetimeMin = Math.round((payload.exp - payload.iat) / 60);
  note("Durée de vie d'un jeton d'accès", `${lifetimeMin} minutes`);
  check("Le jeton d'accès expire en une heure ou moins", lifetimeMin <= 60, `${lifetimeMin} min`);
  note("Contenu du jeton", `rôle=${payload.role} · aal=${payload.aal ?? "?"} · session=${payload.session_id ? "oui" : "non"}`);
  const sensitive = ["password", "secret", "plan", "is_admin", "role_admin"].filter((k) => k in payload);
  check("Le jeton ne transporte aucune donnée sensible", sensitive.length === 0, sensitive.join(", "));
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
  check("Audit mené à son terme", false, String(e?.message ?? e));
} finally {
  for (const id of created) { try { await admin.auth.admin.deleteUser(id); } catch { /* déjà parti */ } }
  console.log("\nNettoyage : comptes d'audit supprimés.");
  const graded = R.filter((x) => typeof x.ok === "boolean");
  console.log(`\n${graded.filter((x) => x.ok).length}/${graded.length} PASS`);
  process.exit(graded.some((x) => !x.ok) ? 1 : 0);
}
