/**
 * Test RLS multi-utilisateurs (bêta) : crée deux comptes jetables A et B,
 * vérifie l'isolation des données, les quotas serveur et la protection du
 * plan, puis SUPPRIME les deux comptes (aucune donnée résiduelle).
 * Usage : node scripts/rls-test.mjs
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
const check = (name, ok, detail = "") =>
  results.push({ name, ok, detail }) && console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);

const PASSWORD = "Rls-Test-2026!secure";
const stamp = Date.now();
const emailA = `rls-test-a-${stamp}@example.com`;
const emailB = `rls-test-b-${stamp}@example.com`;
let userA, userB;

async function userClient(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Connexion ${email} : ${error.message}`);
  return { client: c, userId: data.user.id };
}

try {
  // ---- Création des comptes (confirmés directement : test serveur) ----
  for (const [label, email] of [["A", emailA], ["B", emailB]]) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
    });
    if (error) throw new Error(`Création ${label} : ${error.message}`);
    if (label === "A") userA = data.user; else userB = data.user;
  }

  const a = await userClient(emailA);
  const b = await userClient(emailB);

  // ---- Plan Free automatique ----
  const { data: subA } = await a.client.from("subscriptions").select("plan, status").eq("user_id", a.userId).maybeSingle();
  check("Free automatique à l'inscription", subA?.plan === "free" && subA?.status === "active", JSON.stringify(subA));

  // ---- A crée un logement ----
  const { data: propA, error: insErr } = await a.client.from("properties").insert({
    owner_id: a.userId, name: "Bien RLS A", address: "1 rue Test", postal_code: "75001",
    city: "Paris", type: "T2", surface: 30, rooms: 1, purchase_price: 100000,
    purchase_date: "2024-01-01", rent: 500, charges: 50, status: "vacant",
  }).select("id").single();
  check("A crée son logement", !insErr && !!propA?.id, insErr?.message ?? "");

  // ---- Quota Free : 2e logement refusé par le trigger ----
  const { error: quotaErr } = await a.client.from("properties").insert({
    owner_id: a.userId, name: "Bien RLS A2", address: "2 rue Test", postal_code: "75001",
    city: "Paris", type: "T2", surface: 30, rooms: 1, purchase_price: 100000,
    purchase_date: "2024-01-01", rent: 500, charges: 50, status: "vacant",
  });
  check("Quota Free (2e logement refusé)", !!quotaErr, quotaErr?.message?.slice(0, 60) ?? "AUCUNE ERREUR");

  // ---- B ne lit pas les données de A ----
  const { data: bReads } = await b.client.from("properties").select("id").eq("id", propA.id);
  check("B ne lit pas le logement de A", (bReads ?? []).length === 0);

  // ---- B ne modifie pas le logement de A ----
  const { data: bUpd } = await b.client.from("properties").update({ name: "PIRATE" }).eq("id", propA.id).select("id");
  check("B ne modifie pas le logement de A", (bUpd ?? []).length === 0);

  // ---- B ne supprime pas le logement de A ----
  const { data: bDel } = await b.client.from("properties").delete().eq("id", propA.id).select("id");
  check("B ne supprime pas le logement de A", (bDel ?? []).length === 0);

  // ---- B insère un logement au nom de A (owner_id falsifié) ----
  const { error: spoofErr } = await b.client.from("properties").insert({
    owner_id: a.userId, name: "Spoof", address: "3 rue Test", postal_code: "75001",
    city: "Paris", type: "T2", surface: 30, rooms: 1, purchase_price: 1,
    purchase_date: "2024-01-01", rent: 1, charges: 0, status: "vacant",
  });
  check("B ne crée pas de logement au nom de A", !!spoofErr, spoofErr?.message?.slice(0, 60) ?? "AUCUNE ERREUR");

  // ---- A ne peut pas s'attribuer un plan payant ----
  const { data: planUpd, error: planErr } = await a.client.from("profiles").update({ plan: "business" }).eq("id", a.userId).select("plan");
  const planBlocked = !!planErr || (planUpd ?? []).length === 0 || planUpd?.[0]?.plan !== "business";
  // Revérification en base via admin.
  const { data: planNow } = await admin.from("profiles").select("plan").eq("id", a.userId).single();
  check("A ne change pas son plan (colonne protégée)", planBlocked && planNow?.plan === "free", `plan en base : ${planNow?.plan}`);

  // ---- A ne peut pas écrire dans subscriptions ----
  const { error: subErr } = await a.client.from("subscriptions").update({ plan: "business" }).eq("user_id", a.userId);
  const { data: subNow } = await admin.from("subscriptions").select("plan").eq("user_id", a.userId).single();
  check("A ne modifie pas son abonnement", subNow?.plan === "free", subErr?.message?.slice(0, 50) ?? "silencieux (0 ligne)");

  // ---- Storage : B n'accède pas au dossier de A ----
  const path = `${a.userId}/${propA.id}/rls-test.pdf`;
  const { error: upErr } = await a.client.storage.from("property-documents").upload(path, new Blob(["test"]), { contentType: "application/pdf" });
  check("A téléverse un document", !upErr, upErr?.message ?? "");
  const { data: bSigned, error: bSignErr } = await b.client.storage.from("property-documents").createSignedUrl(path, 60);
  check("B n'obtient pas d'URL signée du fichier de A", !!bSignErr || !bSigned?.signedUrl, bSignErr?.message?.slice(0, 50) ?? "");
  const { data: bList } = await b.client.storage.from("property-documents").list(a.userId);
  check("B ne liste pas le dossier Storage de A", (bList ?? []).length === 0);

  // ---- B ne lit pas les notifications de A ----
  await admin.from("notifications").insert({ user_id: a.userId, title: "RLS", description: "t", category: "systeme", priority: "basse", dedupe_key: `rls:${stamp}` });
  const { data: bNotif } = await b.client.from("notifications").select("id").eq("user_id", a.userId);
  check("B ne lit pas les notifications de A", (bNotif ?? []).length === 0);
} catch (e) {
  console.error("ERREUR TEST :", e.message);
  process.exitCode = 1;
} finally {
  // ---- Nettoyage complet : Storage puis comptes (cascade DB) ----
  for (const u of [userA, userB]) {
    if (!u) continue;
    const { data: files } = await admin.storage.from("property-documents").list(u.id, { limit: 100 });
    for (const f of files ?? []) {
      const { data: sub } = await admin.storage.from("property-documents").list(`${u.id}/${f.name}`, { limit: 100 });
      const paths = (sub ?? []).map((s) => `${u.id}/${f.name}/${s.name}`);
      if (paths.length) await admin.storage.from("property-documents").remove(paths);
    }
    await admin.auth.admin.deleteUser(u.id);
  }
  console.log("Nettoyage : comptes de test supprimés.");
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} tests PASS`);
  if (failed) process.exitCode = 1;
}
