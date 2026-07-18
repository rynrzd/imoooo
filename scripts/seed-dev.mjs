/**
 * Seed de DÉVELOPPEMENT — jamais exécuté automatiquement, jamais en prod.
 *
 * Usage :
 *   SEED_EMAIL=compte-test@exemple.fr SEED_PASSWORD=... node scripts/seed-dev.mjs
 *
 * - Se connecte avec un COMPTE DE TEST existant et confirmé (jamais un vrai compte).
 * - Crée 3 logements + locataires + baux + une dépense et un chantier, via
 *   l'API publique (la RLS s'applique : les données appartiennent au compte).
 * - Suppression facile : supprimer les logements depuis l'interface
 *   (cascade sur baux, loyers, documents, photos) ou supprimer le compte test.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  console.error("Refus : ce script de seed ne s'exécute jamais en production.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!email || !password) {
  console.error("Renseignez SEED_EMAIL et SEED_PASSWORD (compte de test confirmé).");
  process.exit(1);
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (authError) {
  console.error(`Connexion impossible : ${authError.message}`);
  process.exit(1);
}
const ownerId = auth.user.id;
console.log(`Seed pour le compte test ${email} (${ownerId})`);

const PROPERTIES = [
  { name: "Studio Test Centre", address: "1 rue du Test", postal_code: "69001", city: "Lyon", type: "Studio", surface: 24, rooms: 1, purchase_price: 120000, purchase_date: "2022-03-01", rent: 500, charges: 40, status: "loue" },
  { name: "T2 Test Gare", address: "2 avenue du Test", postal_code: "69003", city: "Lyon", type: "T2", surface: 45, rooms: 2, purchase_price: 195000, purchase_date: "2023-06-15", rent: 800, charges: 60, status: "vacant" },
  { name: "T3 Test Parc", address: "3 place du Test", postal_code: "69006", city: "Lyon", type: "T3", surface: 68, rooms: 3, purchase_price: 290000, purchase_date: "2021-11-20", rent: 1150, charges: 90, status: "loue" },
];

for (const [i, p] of PROPERTIES.entries()) {
  const { data: property, error } = await supabase
    .from("properties").insert({ ...p, owner_id: ownerId }).select("id, name").single();
  if (error) { console.error(`Logement « ${p.name} » : ${error.message}`); continue; }
  console.log(`✓ ${property.name}`);

  if (p.status !== "loue") continue;
  const { data: tenant } = await supabase
    .from("tenants")
    .insert({ owner_id: ownerId, first_name: "Locataire", last_name: `Test ${i + 1}`, email: `locataire${i + 1}@test.fr`, phone: "0600000000" })
    .select("id").single();
  if (tenant) {
    await supabase.from("leases").insert({
      owner_id: ownerId, property_id: property.id, tenant_id: tenant.id,
      entry_date: "2025-01-01", rent: p.rent, charges: p.charges, deposit: p.rent,
    });
    console.log(`  ✓ bail actif`);
  }
  await supabase.from("expenses").insert({
    owner_id: ownerId, property_id: property.id, label: "Assurance PNO (seed)",
    category: "assurance", amount: 120, date: "2026-01-10",
  });
  await supabase.from("maintenance_records").insert({
    owner_id: ownerId, property_id: property.id, title: "Peinture séjour (seed)",
    company: "Artisan Test", amount: 900, date: "2026-05-05", status: "en_cours",
  });
}
console.log("Seed terminé. Ouvrez l'application avec le compte test.");
