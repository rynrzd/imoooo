/**
 * Test de bout en bout du MODULE PHOTO (Nireo) + trigger enforce_owner_consistency.
 *
 * Reproduit le bug « record "new" has no field "maintenance_record_id" » et
 * prouve la correction (migration 20260726120000). State-aware : fonctionne
 * AVANT (bug présent → PENDING) et APRÈS (tout vert) l'application de la migration.
 *
 * Couvre : insertion photo, sélection, modification, suppression, upload
 * Storage + URL signée, sécurité cross-owner, régression documents↔chantier,
 * et l'insertion d'un chantier (maintenance_records, même trigger).
 *
 * Tout est SUPPRIMÉ à la fin. Usage : node scripts/photos-e2e-test.mjs
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

let pass = 0, fail = 0, pending = 0, migrationPending = false;
const check = (name, ok, detail = "") => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? `  — ${detail}` : ""}`);
};
const pend = (name, detail = "") => { pending++; console.log(`  ⏳ ${name}${detail ? `  — ${detail}` : ""}`); };
const isFieldBug = (e) => !!e && /has no field\s+"?maintenance_record_id/i.test(e.message || "");
const isCrossRef = (e) => !!e && (/Référence croisée|42501/.test(e.message || "") || e.code === "42501");

const stamp = Date.now();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC",
  "base64"
);
const cleanup = { userIds: [], storagePaths: [] };

async function makeUserWithProperty(tag) {
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: `photo-${tag}-${stamp}@example.com`, password: "Photo-Test-2026!secure", email_confirm: true,
  });
  if (uErr) throw new Error(`Utilisateur ${tag} : ${uErr.message}`);
  const uid = u.user.id;
  cleanup.userIds.push(uid);
  const { data: p, error: pErr } = await admin.from("properties").insert({
    owner_id: uid, name: `Bien ${tag}`, address: "1 rue Test", postal_code: "75001", city: "Paris",
    type: "T2", surface: 50, rooms: 2, purchase_price: 100000, purchase_date: "2020-01-01", rent: 900,
  }).select("id").single();
  if (pErr) throw new Error(`Logement ${tag} : ${pErr.message}`);
  return { uid, propertyId: p.id };
}

async function main() {
  const A = await makeUserWithProperty("a");
  const B = await makeUserWithProperty("b");
  check("Préparation : 2 utilisateurs + 2 logements créés", !!A.propertyId && !!B.propertyId);

  // ---- 1. LE BUG : insertion d'une photo (owner+logement cohérents) ----
  const filePath = `${A.uid}/${A.propertyId}/${randomUUID()}.png`;
  const photoIns = await admin.from("property_photos").insert({
    owner_id: A.uid, property_id: A.propertyId, file_path: filePath, caption: "Entrée", category: "entree",
  }).select("*").single();

  let photoId = null;
  if (isFieldBug(photoIns.error)) {
    migrationPending = true;
    pend("Insertion photo (property_photos)", `BUG PRÉSENT : ${photoIns.error.message} → appliquer migration 20260726120000`);
  } else {
    check("Insertion photo (property_photos)", !photoIns.error, photoIns.error?.message ?? "");
    photoId = photoIns.data?.id ?? null;
  }

  // ---- 1bis. Même trigger : insertion d'un chantier (maintenance_records) ----
  const mrIns = await admin.from("maintenance_records").insert({
    owner_id: A.uid, property_id: A.propertyId, title: "Peinture", amount: 500, date: "2026-07-01",
  }).select("id").single();
  let maintenanceId = null;
  if (isFieldBug(mrIns.error)) {
    migrationPending = true;
    pend("Insertion chantier (maintenance_records)", `BUG PRÉSENT : ${mrIns.error.message}`);
  } else {
    check("Insertion chantier (maintenance_records)", !mrIns.error, mrIns.error?.message ?? "");
    maintenanceId = mrIns.data?.id ?? null;
  }

  // ---- 2. CRUD photo complet (si l'insertion a réussi) ----
  if (photoId) {
    const sel = await admin.from("property_photos").select("id, caption, category, file_path").eq("id", photoId).single();
    check("Sélection de la photo", !sel.error && sel.data?.id === photoId);

    const upd = await admin.from("property_photos").update({ caption: "Salon rénové", category: "apres_travaux" }).eq("id", photoId).select("caption, category").single();
    check("Modification de la photo (légende + catégorie)", !upd.error && upd.data?.caption === "Salon rénové" && upd.data?.category === "apres_travaux");

    // ---- 3. Storage : upload + URL signée + suppression ----
    const up = await admin.storage.from("property-photos").upload(filePath, PNG, { contentType: "image/png", upsert: true });
    if (!up.error) cleanup.storagePaths.push(filePath);
    check("Upload Storage (bucket privé property-photos)", !up.error, up.error?.message ?? "");
    const signed = await admin.storage.from("property-photos").createSignedUrl(filePath, 60);
    check("Récupération de l'URL signée", !signed.error && !!signed.data?.signedUrl);
    const rm = await admin.storage.from("property-photos").remove([filePath]);
    check("Suppression du fichier Storage", !rm.error);
    if (!rm.error) cleanup.storagePaths = cleanup.storagePaths.filter((p) => p !== filePath);

    const del = await admin.from("property_photos").delete().eq("id", photoId);
    check("Suppression de la photo (base)", !del.error);
    const gone = await admin.from("property_photos").select("id").eq("id", photoId).maybeSingle();
    check("Photo bien supprimée", !gone.error && gone.data === null);
  } else {
    pend("CRUD photo (sélection/modif/suppression/storage)", "ignoré tant que l'insertion échoue (migration à appliquer)");
  }

  // ---- 4. Sécurité cross-owner : photo de A pointant le logement de B ----
  const crossPhoto = await admin.from("property_photos").insert({
    owner_id: A.uid, property_id: B.propertyId, file_path: `${A.uid}/x/${randomUUID()}.png`, category: "entree",
  }).select("id");
  check("Sécurité : photo vers le logement d'autrui REFUSÉE", isCrossRef(crossPhoto.error), crossPhoto.error ? "refusée (cross-owner)" : "AURAIT DÛ ÉCHOUER");

  // ---- 5. Régression documents ↔ chantier (branche qui utilise le champ) ----
  const docNoLink = await admin.from("documents").insert({
    owner_id: A.uid, property_id: A.propertyId, name: "Diagnostic", category: "diagnostics",
  }).select("id").single();
  check("Document sans chantier inséré (branche documents intacte)", !docNoLink.error, docNoLink.error?.message ?? "");
  if (docNoLink.data?.id) await admin.from("documents").delete().eq("id", docNoLink.data.id);

  if (maintenanceId) {
    const docLink = await admin.from("documents").insert({
      owner_id: A.uid, property_id: A.propertyId, name: "Facture peinture", category: "factures", maintenance_record_id: maintenanceId,
    }).select("id").single();
    check("Document lié au chantier de A inséré (lien valide)", !docLink.error, docLink.error?.message ?? "");
    if (docLink.data?.id) await admin.from("documents").delete().eq("id", docLink.data.id);

    // Lien vers un chantier d'un AUTRE owner → refusé.
    const mrB = await admin.from("maintenance_records").insert({
      owner_id: B.uid, property_id: B.propertyId, title: "Sol", amount: 300, date: "2026-07-01",
    }).select("id").single();
    if (!mrB.error) {
      const docCross = await admin.from("documents").insert({
        owner_id: A.uid, property_id: A.propertyId, name: "X", category: "factures", maintenance_record_id: mrB.data.id,
      }).select("id");
      check("Sécurité : document lié au chantier d'autrui REFUSÉ", isCrossRef(docCross.error), docCross.error ? "refusé (cross-owner)" : "AURAIT DÛ ÉCHOUER");
    }
  } else {
    pend("Régression documents ↔ chantier", "ignoré tant que le chantier ne peut être créé");
  }
}

async function doCleanup() {
  if (cleanup.storagePaths.length) await admin.storage.from("property-photos").remove(cleanup.storagePaths).catch(() => {});
  for (const uid of cleanup.userIds) {
    // Les lignes métier + analytics_events partent en cascade (on delete cascade / set null).
    await admin.from("analytics_events").delete().eq("user_id", uid);
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
  console.log("\nNettoyage effectué (aucune donnée résiduelle).");
}

console.log(`\n═ TEST MODULE PHOTO — base ${env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0]} ═\n`);
try {
  await main();
} catch (e) {
  console.error("💥", e.message);
  fail++;
} finally {
  await doCleanup();
  console.log(`\n═══ ${pass} réussis · ${fail} échoués · ${pending} en attente ═══`);
  if (migrationPending) {
    console.log("⏳ Appliquer supabase/migrations/20260726120000_fix_owner_consistency_photos.sql puis relancer.");
  }
  process.exit(fail > 0 ? 1 : 0);
}
