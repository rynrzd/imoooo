/**
 * Export de sauvegarde des données (serveur uniquement, aucun secret dans
 * la sortie). Écrit backups/immopilot-backup-<date>.json avec toutes les
 * tables métier + la liste des fichiers Storage (métadonnées, pas les
 * binaires). Usage : node scripts/export-backup.mjs
 * Le dossier backups/ est ignoré par Git.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TABLES = [
  "profiles", "subscriptions", "properties", "tenants", "leases",
  "rent_payments", "expenses", "maintenance_records", "documents",
  "property_photos", "notifications", "notification_preferences",
  "email_logs", "contact_messages", "founder_purchases", "founder_waitlist",
];
const BUCKETS = ["property-documents", "property-photos", "expense-receipts", "profile-avatars", "maintenance-files"];

const backup = { exportedAt: new Date().toISOString(), tables: {}, storage: {} };

for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) { console.error(`${table} : ${error.message}`); break; }
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  backup.tables[table] = rows;
  console.log(`${table} : ${rows.length} lignes`);
}

// Métadonnées Storage (chemins + tailles — les binaires se sauvegardent
// via l'interface Supabase ou un téléchargement dédié, voir BACKUP_AND_RECOVERY.md).
for (const bucket of BUCKETS) {
  const files = [];
  const { data: level1 } = await admin.storage.from(bucket).list("", { limit: 1000 });
  for (const dir of level1 ?? []) {
    if (dir.id) { files.push({ path: dir.name, size: dir.metadata?.size ?? null }); continue; }
    const { data: level2 } = await admin.storage.from(bucket).list(dir.name, { limit: 1000 });
    for (const sub of level2 ?? []) {
      if (sub.id) { files.push({ path: `${dir.name}/${sub.name}`, size: sub.metadata?.size ?? null }); continue; }
      const { data: level3 } = await admin.storage.from(bucket).list(`${dir.name}/${sub.name}`, { limit: 1000 });
      for (const f of level3 ?? []) files.push({ path: `${dir.name}/${sub.name}/${f.name}`, size: f.metadata?.size ?? null });
    }
  }
  backup.storage[bucket] = files;
  console.log(`storage/${bucket} : ${files.length} fichiers`);
}

mkdirSync(new URL("../backups/", import.meta.url), { recursive: true });
const file = new URL(`../backups/immopilot-backup-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(backup, null, 1));
console.log(`\nSauvegarde écrite : ${file.pathname}`);
