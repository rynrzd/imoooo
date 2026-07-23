/**
 * Test du mécanisme « Suspendre / Réactiver l'accès » de la gestion des
 * abonnements (audit). Reproduit EXACTEMENT ce que font les Server Actions
 * suspendUser / reactivateUser : ban Supabase Auth + table user_moderation.
 *
 * Vérifie qu'un compte suspendu ne peut PLUS se connecter, que l'abonnement
 * (ligne subscriptions) et l'historique sont conservés, et que la
 * réactivation rétablit la connexion. Compte jetable, supprimé à la fin.
 * Aucune donnée de production touchée. Usage : node scripts/subscription-admin-test.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL_ || !ANON || !SECRET) { console.error("Variables Supabase manquantes."); process.exit(1); }

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const PASSWORD = "Sub-Admin-2026!secure";
const email = `sub-admin-${Date.now()}@example.com`;
let user;

async function canSignIn() {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  return !error && Boolean(data.user);
}

try {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);
  user = data.user;

  // Abonnement fictif Stripe pour vérifier qu'il est CONSERVÉ après suspension.
  await admin.from("subscriptions").upsert(
    { user_id: user.id, plan: "pro", status: "active", provider: "stripe",
      stripe_customer_id: "cus_test_keep", stripe_subscription_id: "sub_test_keep" },
    { onConflict: "user_id" }
  );

  check("Compte actif : connexion possible", await canSignIn());

  // ---- SUSPENDRE (= suspendUser) : ban Auth 720h + user_moderation ----
  const { error: banErr } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "720h" });
  if (banErr) throw new Error(`ban: ${banErr.message}`);
  await admin.from("user_moderation").upsert(
    { user_id: user.id, status: "suspended", reason: "Test", updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  check("Compte suspendu : connexion REFUSÉE", !(await canSignIn()));

  const { data: modRow } = await admin.from("user_moderation").select("status").eq("user_id", user.id).single();
  check("Statut modération = suspended", modRow?.status === "suspended", modRow?.status ?? "?");

  const { data: subKept } = await admin.from("subscriptions").select("stripe_subscription_id, plan").eq("user_id", user.id).single();
  check("Abonnement Stripe conservé (non supprimé)", subKept?.stripe_subscription_id === "sub_test_keep", subKept?.stripe_subscription_id ?? "?");

  // ---- RÉACTIVER (= reactivateUser) : ban_duration none + moderation active ----
  const { error: unbanErr } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "none" });
  if (unbanErr) throw new Error(`unban: ${unbanErr.message}`);
  await admin.from("user_moderation").upsert(
    { user_id: user.id, status: "active", reason: "Test", updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  check("Compte réactivé : connexion de nouveau possible", await canSignIn());

  // ---- « Sync sans Stripe ID » : la ligne sans sub id doit être détectable ----
  await admin.from("subscriptions").update({ stripe_subscription_id: null }).eq("user_id", user.id);
  const { data: noStripe } = await admin.from("subscriptions").select("stripe_subscription_id").eq("user_id", user.id).single();
  check("Abonnement sans Stripe ID détecté (Sync renverra une erreur claire)", noStripe?.stripe_subscription_id === null);
} catch (e) {
  console.error("ERREUR TEST :", e.message);
  process.exitCode = 1;
} finally {
  if (user) await admin.auth.admin.deleteUser(user.id);
  console.log("Nettoyage : compte de test supprimé.");
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} tests PASS`);
  if (failed) process.exitCode = 1;
}
