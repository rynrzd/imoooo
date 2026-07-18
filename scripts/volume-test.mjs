/**
 * Test de volume (bêta) : compte jetable Business+ avec un jeu réaliste
 * (100 logements, 300 locataires/baux, 1000 paiements, 500 dépenses,
 * 300 travaux, 500 documents, 300 photos-métadonnées), mesure du temps de
 * chargement réel (mêmes requêtes que l'application), puis SUPPRESSION
 * complète du compte. Usage : node scripts/volume-test.mjs
 * ⚠️ Ne jamais exécuter contre un compte réel — le script crée le sien.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let uid;

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
async function bulk(table, rows) {
  for (const part of chunk(rows, 200)) {
    const { error } = await admin.from(table).insert(part);
    if (error) throw new Error(`${table} : ${error.message}`);
  }
}

try {
  const email = `volume-test-${Date.now()}@example.com`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password: "Volume-2026!x", email_confirm: true });
  if (cErr) throw new Error(cErr.message);
  uid = created.user.id;
  await admin.from("profiles").update({ plan: "business" }).eq("id", uid);
  await admin.from("subscriptions").update({ plan: "business" }).eq("user_id", uid);

  // ---- Seed volumétrique ----
  const t0 = Date.now();
  const properties = Array.from({ length: 100 }, (_, i) => ({
    owner_id: uid, name: `Bien ${i + 1}`, address: `${i + 1} rue Volume`, postal_code: "75010",
    city: "Paris", type: ["Studio", "T1", "T2", "T3"][i % 4], surface: 20 + (i % 60), rooms: 1 + (i % 4),
    purchase_price: 100000 + i * 1000, purchase_date: "2022-01-01", rent: 500 + (i % 40) * 10,
    charges: 50, status: i % 3 === 0 ? "vacant" : "loue",
  }));
  await bulk("properties", properties);
  const { data: propIds } = await admin.from("properties").select("id").eq("owner_id", uid);

  const tenants = Array.from({ length: 300 }, (_, i) => ({
    owner_id: uid, first_name: `Prénom${i}`, last_name: `Nom${i}`, email: `t${i}@example.com`, phone: "0600000000",
  }));
  await bulk("tenants", tenants);
  const { data: tenantIds } = await admin.from("tenants").select("id").eq("owner_id", uid);

  const leases = tenantIds.map((t, i) => ({
    owner_id: uid, property_id: propIds[i % propIds.length].id, tenant_id: t.id,
    entry_date: "2024-01-01", exit_date: i < 100 ? null : "2025-12-31", rent: 600, charges: 60, deposit: 600,
  }));
  await bulk("leases", leases);
  const { data: leaseIds } = await admin.from("leases").select("id").eq("owner_id", uid).is("exit_date", null).limit(100);

  const months = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2025-12-01", "2025-11-01", "2025-10-01"];
  const payments = leaseIds.flatMap((l) => months.map((m, j) => ({
    owner_id: uid, lease_id: l.id, month: m, expected: 660,
    received: j % 3 === 0 ? 0 : 660, status: j % 3 === 0 ? "retard" : "paye",
  })));
  await bulk("rent_payments", payments); // 100 × 10 = 1000

  await bulk("expenses", Array.from({ length: 500 }, (_, i) => ({
    owner_id: uid, property_id: propIds[i % propIds.length].id, label: `Dépense ${i}`,
    category: ["travaux", "assurance", "taxe_fonciere", "copropriete", "autres"][i % 5], amount: 50 + (i % 200),
    date: `2026-0${1 + (i % 6)}-15`,
  })));
  await bulk("maintenance_records", Array.from({ length: 300 }, (_, i) => ({
    owner_id: uid, property_id: propIds[i % propIds.length].id, title: `Chantier ${i}`,
    company: "Entreprise", amount: 300 + i, date: `2026-0${1 + (i % 6)}-01`,
    status: ["planifie", "en_cours", "termine"][i % 3],
  })));
  await bulk("documents", Array.from({ length: 500 }, (_, i) => ({
    owner_id: uid, property_id: propIds[i % propIds.length].id, name: `Document ${i}`,
    category: ["bail", "diagnostics", "assurance", "factures", "autres"][i % 5], file_type: "pdf", size_bytes: 10000,
  })));
  await bulk("property_photos", Array.from({ length: 300 }, (_, i) => ({
    owner_id: uid, property_id: propIds[i % propIds.length].id,
    file_path: `https://images.unsplash.com/photo-${i}`, caption: `Photo ${i}`,
    category: ["entree", "sortie", "dommages"][i % 3], taken_at: "2026-01-01",
  })));
  console.log(`Seed : ${Date.now() - t0} ms (100 logements, 300 baux, 1000 paiements, 500 dépenses, 300 travaux, 500 docs, 300 photos)`);

  // ---- Mesure : chargement identique à fetchAppData (client utilisateur) ----
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Volume-2026!x" });
  for (const run of [1, 2]) {
    const t1 = Date.now();
    const results = await Promise.all([
      c.from("leases").select("id, property_id, tenant_id, entry_date, exit_date, rent, charges, deposit, tenants (first_name, last_name, email, phone)"),
      c.from("properties").select("id, name, address, postal_code, city, type, surface, rooms, photo_url, purchase_price, purchase_date, rent, charges, status").order("created_at"),
      c.from("rent_payments").select("id, lease_id, month, expected, received, paid_at, status, comment").order("month", { ascending: false }),
      c.from("expenses").select("id, property_id, label, category, amount, date, supplier, receipt_path, maintenance_record_id").order("date", { ascending: false }),
      c.from("documents").select("id, property_id, name, category, file_path, file_type, size_bytes, maintenance_record_id, expires_at, created_at").order("created_at", { ascending: false }),
      c.from("property_photos").select("id, property_id, file_path, caption, category, taken_at").order("taken_at", { ascending: false }),
      c.from("maintenance_records").select("id, property_id, title, company, amount, date, status, actual_cost, progress, end_date").order("date", { ascending: false }),
      c.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
    ]);
    const err = results.find((r) => r.error);
    if (err) throw new Error(err.error.message);
    const rows = results.reduce((n, r) => n + (r.data?.length ?? 0), 0);
    console.log(`Chargement complet (run ${run}) : ${Date.now() - t1} ms — ${rows} lignes`);
  }
} catch (e) {
  console.error("ERREUR :", e.message);
  process.exitCode = 1;
} finally {
  if (uid) {
    await admin.auth.admin.deleteUser(uid);
    console.log("Nettoyage : compte de volume supprimé (cascade complète).");
  }
}
