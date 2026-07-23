/**
 * Test faille « référence croisée de propriété » (audit sécurité).
 *
 * La RLS INSERT ne vérifie que owner_id = auth.uid(). Elle NE vérifie PAS
 * que le property_id / tenant_id / lease_id référencé appartient au même
 * propriétaire. Un utilisateur B peut donc planter un bail ACTIF sur le
 * logement d'un utilisateur A (property_id de A, owner_id = B) : l'index
 * unique partiel leases_one_active_per_property empêche alors A d'attribuer
 * son propre bail actif → déni de service persistant sur le bien de A.
 *
 * AVANT correctif : les insertions croisées RÉUSSISSENT (FAIL sécurité).
 * APRÈS correctif : elles sont REFUSÉES par le trigger enforce_owner_consistency.
 *
 * Comptes jetables, supprimés en fin de test. Aucune donnée de production touchée.
 * Usage : node scripts/cross-owner-test.mjs
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
if (!URL_ || !ANON || !SECRET) {
  console.error("Variables Supabase manquantes dans .env.local");
  process.exit(1);
}

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const PASSWORD = "Cross-Owner-2026!secure";
const stamp = Date.now();
const emailA = `xo-test-a-${stamp}@example.com`;
const emailB = `xo-test-b-${stamp}@example.com`;
let userA, userB;

async function userClient(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Connexion ${email} : ${error.message}`);
  return { client: c, userId: data.user.id };
}

// A est mis sur un plan illimité côté serveur pour tester la logique métier,
// pas le quota (le quota masquerait le résultat RLS).
async function makeUnlimited(userId) {
  await admin.from("subscriptions").update({ plan: "business", status: "active" }).eq("user_id", userId);
  await admin.from("profiles").update({ plan: "business" }).eq("id", userId);
}

try {
  for (const [label, email] of [["A", emailA], ["B", emailB]]) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(`Création ${label} : ${error.message}`);
    if (label === "A") userA = data.user; else userB = data.user;
  }
  await makeUnlimited(userA.id);
  await makeUnlimited(userB.id);

  const a = await userClient(emailA);
  const b = await userClient(emailB);

  // A crée un logement VACANT + un locataire.
  const { data: propA } = await a.client.from("properties").insert({
    owner_id: a.userId, name: "Bien A", address: "1 rue A", postal_code: "75001",
    city: "Paris", type: "T2", surface: 30, rooms: 1, purchase_price: 100000,
    purchase_date: "2024-01-01", rent: 500, charges: 50, status: "vacant",
  }).select("id").single();

  // B crée son propre logement + locataire (références légitimes).
  const { data: propB } = await b.client.from("properties").insert({
    owner_id: b.userId, name: "Bien B", address: "1 rue B", postal_code: "75002",
    city: "Paris", type: "T2", surface: 30, rooms: 1, purchase_price: 100000,
    purchase_date: "2024-01-01", rent: 500, charges: 50, status: "vacant",
  }).select("id").single();
  const { data: tenantB } = await b.client.from("tenants").insert({
    owner_id: b.userId, first_name: "Loc", last_name: "B",
  }).select("id").single();

  // ---- Contrôle : B crée un bail 100 % légitime (doit réussir) ----
  const { error: okErr } = await b.client.from("leases").insert({
    owner_id: b.userId, property_id: propB.id, tenant_id: tenantB.id,
    entry_date: "2026-01-01", rent: 500, charges: 50, deposit: 500,
  });
  check("B crée un bail légitime sur son propre bien", !okErr, okErr?.message?.slice(0, 70) ?? "");

  // ---- EXPLOIT 1 : B plante un bail sur le LOGEMENT de A ----
  const { error: xoLease } = await b.client.from("leases").insert({
    owner_id: b.userId, property_id: propA.id, tenant_id: tenantB.id,
    entry_date: "2026-01-01", rent: 999, charges: 0, deposit: 0,
  });
  check("Bail croisé sur le bien de A REFUSÉ", !!xoLease, xoLease ? xoLease.message.slice(0, 70) : "INSÉRÉ (VULNÉRABLE)");

  // ---- EXPLOIT 2 : B crée une dépense sur le logement de A ----
  const { error: xoExpense } = await b.client.from("expenses").insert({
    owner_id: b.userId, property_id: propA.id, label: "Squat", category: "autres",
    amount: 1, date: "2026-01-01",
  });
  check("Dépense croisée sur le bien de A REFUSÉE", !!xoExpense, xoExpense ? xoExpense.message.slice(0, 70) : "INSÉRÉ (VULNÉRABLE)");

  // ---- EXPLOIT 3 : B crée un document sur le logement de A ----
  const { error: xoDoc } = await b.client.from("documents").insert({
    owner_id: b.userId, property_id: propA.id, name: "Squat", category: "autres",
  });
  check("Document croisé sur le bien de A REFUSÉ", !!xoDoc, xoDoc ? xoDoc.message.slice(0, 70) : "INSÉRÉ (VULNÉRABLE)");

  // ---- EXPLOIT 4 : B crée une photo sur le logement de A ----
  const { error: xoPhoto } = await b.client.from("property_photos").insert({
    owner_id: b.userId, property_id: propA.id, file_path: `${b.userId}/x.jpg`,
    category: "dommages",
  });
  check("Photo croisée sur le bien de A REFUSÉE", !!xoPhoto, xoPhoto ? xoPhoto.message.slice(0, 70) : "INSÉRÉ (VULNÉRABLE)");

  // ---- Vérif impact DoS : A peut-il encore attribuer un bail à SON bien ? ----
  const { data: tenantA } = await a.client.from("tenants").insert({
    owner_id: a.userId, first_name: "Loc", last_name: "A",
  }).select("id").single();
  const { error: aBlocked } = await a.client.from("leases").insert({
    owner_id: a.userId, property_id: propA.id, tenant_id: tenantA.id,
    entry_date: "2026-02-01", rent: 500, charges: 50, deposit: 500,
  });
  check("A peut attribuer un bail actif à son propre bien", !aBlocked,
    aBlocked ? `BLOQUÉ par le bail pirate de B : ${aBlocked.message.slice(0, 50)}` : "");
} catch (e) {
  console.error("ERREUR TEST :", e.message);
  process.exitCode = 1;
} finally {
  for (const u of [userA, userB]) {
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  console.log("Nettoyage : comptes de test supprimés.");
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} tests PASS`);
  if (failed) process.exitCode = 1;
}
