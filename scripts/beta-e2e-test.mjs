/**
 * Test E2E bêta : parcours complet d'un utilisateur (données réelles
 * Supabase) — création, modification, suppression, cascades — avec un
 * compte jetable SUPPRIMÉ à la fin. Usage : node scripts/beta-e2e-test.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = "") =>
  results.push(ok) && console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);

const email = `beta-e2e-${Date.now()}@example.com`;
let uid;

try {
  // 1. Inscription (plan Free + onboarding à faire une seule fois)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password: "Beta-E2e-2026!x", email_confirm: true,
  });
  if (cErr) throw new Error(cErr.message);
  uid = created.user.id;
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Beta-E2e-2026!x" });
  const { data: prof } = await c.from("profiles").select("plan, onboarding_completed").eq("id", uid).single();
  check("Profil Free + onboarding non fait (1re connexion)", prof?.plan === "free" && prof?.onboarding_completed === false, JSON.stringify(prof));

  // Onboarding marqué terminé → ne revient plus
  await c.from("profiles").update({ onboarding_completed: true, onboarding_completed_at: new Date().toISOString() }).eq("id", uid);
  const { data: prof2 } = await c.from("profiles").select("onboarding_completed").eq("id", uid).single();
  check("Onboarding persisté (ne revient pas)", prof2?.onboarding_completed === true);

  // 2. LOGEMENT : créer, modifier, rouvrir
  const prop = { owner_id: uid, name: "T2 E2E", address: "1 rue Beta", postal_code: "69001", city: "Lyon", type: "T2", surface: 45, rooms: 2, purchase_price: 150000, purchase_date: "2023-06-01", rent: 700, charges: 80, status: "vacant" };
  const { data: p } = await c.from("properties").insert(prop).select("id").single();
  await c.from("properties").update({ rent: 720 }).eq("id", p.id);
  const { data: pRead } = await c.from("properties").select("rent").eq("id", p.id).single();
  check("Logement : créer + modifier + relire", pRead?.rent === 720);

  // 3. LOCATAIRE + BAIL, logement → loué
  const { data: t } = await c.from("tenants").insert({ owner_id: uid, first_name: "Léa", last_name: "Test", email: "lea@example.com", phone: "0600000000" }).select("id").single();
  const { data: lease } = await c.from("leases").insert({ owner_id: uid, property_id: p.id, tenant_id: t.id, entry_date: "2026-05-01", rent: 720, charges: 80, deposit: 720 }).select("id").single();
  await c.from("properties").update({ status: "loue" }).eq("id", p.id);
  check("Locataire + bail créés, logement loué", !!lease?.id);

  // Modification du bail
  await c.from("leases").update({ deposit: 800 }).eq("id", lease.id);
  const { data: lRead } = await c.from("leases").select("deposit").eq("id", lease.id).single();
  check("Bail : modification persistée", Number(lRead?.deposit) === 800);

  // 4. LOYERS : échéances (mai→juillet), retard, partiel, complet
  const months = ["2026-05-01", "2026-06-01", "2026-07-01"];
  await c.from("rent_payments").upsert(months.map((m) => ({ owner_id: uid, lease_id: lease.id, month: m, expected: 800 })), { onConflict: "lease_id,month", ignoreDuplicates: true });
  await c.from("rent_payments").update({ status: "retard" }).eq("lease_id", lease.id).eq("status", "attente").eq("received", 0).lt("month", "2026-07-01");
  const { data: pays } = await c.from("rent_payments").select("id, month, status").eq("lease_id", lease.id).order("month");
  check("Échéances générées + retards marqués", pays?.length === 3 && pays[0].status === "retard" && pays[1].status === "retard", JSON.stringify(pays?.map((x) => x.status)));
  await c.from("rent_payments").update({ received: 400, status: "partiel", paid_at: "2026-07-16" }).eq("id", pays[0].id);
  await c.from("rent_payments").update({ received: 800, status: "paye", paid_at: "2026-07-16" }).eq("id", pays[1].id);
  const { data: paid } = await c.from("rent_payments").select("status").eq("id", pays[1].id).single();
  check("Paiement partiel + complet enregistrés", paid?.status === "paye");
  // Suppression d'une échéance
  await c.from("rent_payments").delete().eq("id", pays[2].id);
  const { count: payCount } = await c.from("rent_payments").select("id", { count: "exact", head: true }).eq("lease_id", lease.id);
  check("Échéance supprimée", payCount === 2);

  // 5. DÉPENSE + TRAVAUX (dépense liée), modification, suppression
  const { data: w } = await c.from("maintenance_records").insert({ owner_id: uid, property_id: p.id, title: "Peinture", company: "Pro Peinture", amount: 900, date: "2026-07-01", status: "en_cours" }).select("id").single();
  const { data: we } = await c.from("expenses").insert({ owner_id: uid, property_id: p.id, label: "Peinture", category: "travaux", amount: 900, date: "2026-07-01", maintenance_record_id: w.id }).select("id").single();
  await c.from("maintenance_records").update({ status: "termine", actual_cost: 850 }).eq("id", w.id);
  await c.from("expenses").update({ amount: 850 }).eq("maintenance_record_id", w.id);
  // Suppression du chantier + dépense liée (séquence applicative)
  await c.from("expenses").delete().eq("maintenance_record_id", w.id);
  await c.from("maintenance_records").delete().eq("id", w.id);
  const { count: weCount } = await c.from("expenses").select("id", { count: "exact", head: true }).eq("id", we.id);
  check("Travaux + dépense liée : cycle complet + suppression", weCount === 0);

  // 6. DOCUMENT avec fichier Storage privé, puis suppression complète
  const path = `${uid}/${p.id}/e2e-doc.pdf`;
  const { error: upErr } = await c.storage.from("property-documents").upload(path, new Blob(["doc"]), { contentType: "application/pdf" });
  const { data: doc } = await c.from("documents").insert({ owner_id: uid, property_id: p.id, name: "Bail signé", category: "bail", file_path: path, size_bytes: 3, file_type: "pdf" }).select("id").single();
  const { data: signed } = await c.storage.from("property-documents").createSignedUrl(path, 60);
  check("Document : upload + URL signée (accès privé)", !upErr && !!doc?.id && !!signed?.signedUrl);
  await c.from("documents").delete().eq("id", doc.id);
  await c.storage.from("property-documents").remove([path]);
  const { data: gone } = await c.storage.from("property-documents").list(`${uid}/${p.id}`);
  check("Document supprimé (ligne + fichier Storage)", (gone ?? []).every((f) => f.name !== "e2e-doc.pdf"));

  // 7. PHOTO : créer + supprimer
  const { data: ph } = await c.from("property_photos").insert({ owner_id: uid, property_id: p.id, file_path: "https://images.unsplash.com/photo-x", caption: "Salon", category: "entree", taken_at: "2026-07-01" }).select("id").single();
  await c.from("property_photos").delete().eq("id", ph.id);
  const { count: phCount } = await c.from("property_photos").select("id", { count: "exact", head: true }).eq("owner_id", uid);
  check("Photo : création + suppression", phCount === 0);

  // 8. Suppression du bail actif → logement vacant + locataire nettoyé (séquence app)
  const { data: delLease } = await c.from("leases").delete().eq("id", lease.id).select("property_id, tenant_id, exit_date").single();
  if (delLease.exit_date === null) await c.from("properties").update({ status: "vacant" }).eq("id", delLease.property_id);
  const { count: remaining } = await c.from("leases").select("id", { count: "exact", head: true }).eq("tenant_id", delLease.tenant_id);
  if ((remaining ?? 0) === 0) await c.from("tenants").delete().eq("id", delLease.tenant_id);
  const { data: pAfter } = await c.from("properties").select("status").eq("id", p.id).single();
  const { count: tCount } = await c.from("tenants").select("id", { count: "exact", head: true }).eq("owner_id", uid);
  check("Bail supprimé → logement vacant, aucun locataire orphelin", pAfter?.status === "vacant" && tCount === 0);

  // 9. Suppression du logement → cascade totale, aucune donnée orpheline
  await c.from("properties").delete().eq("id", p.id);
  const counts = await Promise.all(["leases", "rent_payments", "expenses", "documents", "property_photos", "maintenance_records"].map(
    (tbl) => c.from(tbl).select("id", { count: "exact", head: true }).eq("owner_id", uid).then((r) => r.count ?? 0)
  ));
  check("Suppression logement : zéro orphelin (6 tables)", counts.every((n) => n === 0), JSON.stringify(counts));

  // 10. Suppression complète du compte (séquence de la route API)
  await admin.auth.admin.deleteUser(uid);
  const { data: profGone } = await admin.from("profiles").select("id").eq("id", uid).maybeSingle();
  const { data: subGone } = await admin.from("subscriptions").select("id").eq("user_id", uid).maybeSingle();
  check("Compte supprimé : Auth + profil + abonnement effacés", !profGone && !subGone);
  uid = null;
} catch (e) {
  console.error("ERREUR :", e.message);
  process.exitCode = 1;
} finally {
  if (uid) { await admin.auth.admin.deleteUser(uid).catch(() => {}); console.log("Nettoyage forcé du compte de test."); }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} tests PASS`);
  if (failed) process.exitCode = 1;
}
