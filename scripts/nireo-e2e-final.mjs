/**
 * Recette finale Nireo — parcours complet sur UN compte jetable.
 *
 * Périmètre volontairement étroit et traçable :
 *   - un seul compte, préfixé `e2e_nireo_` ;
 *   - un seul exemplaire de chaque objet (logement, locataire, bail, loyer,
 *     dépense, travaux, document, photo) ;
 *   - création, modification, suppression, double soumission, erreur puis
 *     reprise d'envoi, blocage du 2e logement en plan Gratuit ;
 *   - isolation RLS vérifiée SANS jamais lire la donnée d'autrui : on prouve
 *     que le compte ne voit QUE ses propres lignes ;
 *   - tout est supprimé à la fin, puis l'absence de résidu est vérifiée.
 *
 * Aucun appel Stripe, aucun webhook, aucune donnée d'un compte existant.
 * Usage : node scripts/nireo-e2e-final.mjs
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
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

const STAMP = Date.now();
const EMAIL = `e2e_nireo_${STAMP}@example.com`;
const PASSWORD = `E2e-Nireo-${STAMP}!x`;
const BUCKETS = [
  "property-documents",
  "property-photos",
  "expense-receipts",
  "profile-avatars",
  "maintenance-files",
];

/** Mois "yyyy-mm" décalé de n mois. */
const shiftMonth = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};

/** Copie EXACTE de rentDaysLate (src/lib/dates.ts) — la recette teste la règle. */
function rentDaysLate(monthKey, now = new Date()) {
  const [y, m] = monthKey.slice(0, 7).split("-").map(Number);
  const dueFrom = new Date(y, m, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - dueFrom.getTime()) / 86_400_000));
}

let uid;
const storagePaths = [];

try {
  /* ---------------------------------------------------------------- */
  /* 0. Compte jetable                                                  */
  /* ---------------------------------------------------------------- */
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (cErr) throw new Error(`création du compte : ${cErr.message}`);
  uid = created.user.id;
  console.log(`\ncompte jetable : ${EMAIL}\nuid            : ${uid}\n`);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await c.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  check("Connexion du compte jetable", !signErr, signErr?.message);

  const { data: prof } = await c.from("profiles").select("plan").eq("id", uid).single();
  check("Profil créé au plan Gratuit", prof?.plan === "free", JSON.stringify(prof));

  /* ---------------------------------------------------------------- */
  /* 1. Schéma des relances : les colonnes existent-elles VRAIMENT ?    */
  /* ---------------------------------------------------------------- */
  const { error: prefErr } = await c
    .from("notification_preferences")
    .select(
      "rent_reminder_mode, rent_reminder_days, rent_reminder_copy_owner, rent_reminder_custom_message"
    )
    .eq("user_id", uid)
    .limit(1);
  check("Schéma relances : colonnes rent_reminder_* présentes", !prefErr, prefErr?.message);

  const { error: logSchemaErr } = await c
    .from("email_logs")
    .select("id, kind, dedupe_key, status")
    .eq("user_id", uid)
    .limit(1);
  check("Schéma relances : table email_logs présente", !logSchemaErr, logSchemaErr?.message);

  /* ---------------------------------------------------------------- */
  /* 2. LOGEMENT — création, modification                               */
  /* ---------------------------------------------------------------- */
  const { data: prop, error: propErr } = await c
    .from("properties")
    .insert({
      owner_id: uid,
      name: "E2E logement",
      address: "1 rue de la Recette",
      postal_code: "69001",
      city: "Lyon",
      type: "T2",
      surface: 40,
      rooms: 2,
      purchase_price: 150000,
      purchase_date: "2023-06-01",
      rent: 700,
      charges: 80,
      status: "vacant",
    })
    .select("id")
    .single();
  check("Logement : création", !propErr && !!prop?.id, propErr?.message);

  await c.from("properties").update({ rent: 720 }).eq("id", prop.id);
  const { data: propRead } = await c.from("properties").select("rent").eq("id", prop.id).single();
  check("Logement : modification persistée", Number(propRead?.rent) === 720);

  /* ---------------------------------------------------------------- */
  /* 3. QUOTA — le 2e logement doit être REFUSÉ en plan Gratuit         */
  /* ---------------------------------------------------------------- */
  const { error: quotaErr } = await c.from("properties").insert({
    owner_id: uid,
    name: "E2E logement refusé",
    address: "2 rue de la Recette",
    postal_code: "69001",
    city: "Lyon",
    type: "T1",
    surface: 20,
    rooms: 1,
    purchase_price: 90000,
    purchase_date: "2023-06-01",
    rent: 400,
    charges: 30,
    status: "vacant",
  });
  const { count: propCount } = await c
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid);
  check(
    "Quota Gratuit : 2e logement refusé par le serveur",
    !!quotaErr && propCount === 1,
    `erreur=${quotaErr?.message ?? "AUCUNE"} total=${propCount}`
  );

  /* ---------------------------------------------------------------- */
  /* 4. LOCATAIRE + BAIL, et DOUBLE SOUMISSION du bail                  */
  /* ---------------------------------------------------------------- */
  const { data: tenant, error: tErr } = await c
    .from("tenants")
    .insert({
      owner_id: uid,
      first_name: "Recette",
      last_name: "E2E",
      email: `e2e_nireo_${STAMP}_locataire@example.com`,
      phone: "0600000000",
    })
    .select("id")
    .single();
  check("Locataire : création", !tErr && !!tenant?.id, tErr?.message);

  const leaseRow = {
    owner_id: uid,
    property_id: prop.id,
    tenant_id: tenant.id,
    entry_date: `${shiftMonth(new Date(), -3)}-01`,
    rent: 720,
    charges: 80,
    deposit: 720,
  };
  const { data: lease, error: lErr } = await c
    .from("leases")
    .insert(leaseRow)
    .select("id")
    .single();
  check("Bail : création", !lErr && !!lease?.id, lErr?.message);
  await c.from("properties").update({ status: "loue" }).eq("id", prop.id);

  // Double soumission : deux insertions IDENTIQUES lancées en parallèle.
  const dbl = await Promise.all([
    c.from("leases").insert(leaseRow).select("id"),
    c.from("leases").insert(leaseRow).select("id"),
  ]);
  const { count: leaseCount } = await c
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("property_id", prop.id);
  check(
    "Double soumission : un seul bail actif par logement",
    leaseCount === 1 && dbl.every((r) => !!r.error),
    `baux=${leaseCount} erreurs=${dbl.map((r) => (r.error ? "refusé" : "ACCEPTÉ")).join(",")}`
  );

  await c.from("leases").update({ deposit: 800 }).eq("id", lease.id);
  const { data: leaseRead } = await c.from("leases").select("deposit").eq("id", lease.id).single();
  check("Bail : modification persistée", Number(leaseRead?.deposit) === 800);

  /* ---------------------------------------------------------------- */
  /* 5. LOYER — échéance, encaissement, double soumission               */
  /* ---------------------------------------------------------------- */
  const lastMonth = shiftMonth(new Date(), -1);
  const payRow = { owner_id: uid, lease_id: lease.id, month: `${lastMonth}-01`, expected: 800 };

  // Double soumission de l'échéance (le upsert applicatif est idempotent).
  await Promise.all([
    c.from("rent_payments").upsert(payRow, { onConflict: "lease_id,month", ignoreDuplicates: true }),
    c.from("rent_payments").upsert(payRow, { onConflict: "lease_id,month", ignoreDuplicates: true }),
  ]);
  const { data: pays, count: payCount } = await c
    .from("rent_payments")
    .select("id, month, status", { count: "exact" })
    .eq("lease_id", lease.id);
  check("Double soumission : une seule échéance créée", payCount === 1, `total=${payCount}`);

  // Bascule en retard : la règle applicative (mois entièrement écoulé).
  const thisMonthFirst = `${shiftMonth(new Date(), 0)}-01`;
  await c
    .from("rent_payments")
    .update({ status: "retard" })
    .eq("lease_id", lease.id)
    .eq("status", "attente")
    .eq("received", 0)
    .lt("month", thisMonthFirst);
  const { data: latePay } = await c
    .from("rent_payments")
    .select("id, month, status")
    .eq("id", pays[0].id)
    .single();
  check("Loyer : échéance du mois écoulé passée en retard", latePay?.status === "retard");

  /* ---------------------------------------------------------------- */
  /* 6. RELANCES — la correction tient-elle sur une VRAIE ligne ?       */
  /* ---------------------------------------------------------------- */
  const monthKey = String(latePay.month).slice(0, 7);
  const nouveau = rentDaysLate(monthKey);
  const ancien = Math.floor(
    (Date.now() - new Date(`${monthKey}-01`).getTime()) / 86_400_000
  );
  const jalons = [3, 7, 15];
  check(
    "Relance : l'ancien calcul rendait les jalons J+3/7/15 inatteignables",
    ancien >= 28 && !jalons.includes(ancien),
    `ancien=${ancien}j`
  );
  check(
    "Relance : le nouveau calcul repart de la fin du mois couvert",
    nouveau === new Date().getDate() - 1 && nouveau < 28,
    `nouveau=${nouveau}j (attendu ${new Date().getDate() - 1})`
  );
  // La fenêtre utile existe désormais : chaque jalon est atteint un jour donné.
  const atteignables = jalons.filter((j) => {
    const d = new Date();
    d.setDate(1 + j);
    return rentDaysLate(monthKey, d) === j;
  });
  check(
    "Relance : les 3 jalons J+3/J+7/J+15 sont désormais atteignables",
    atteignables.length === 3,
    `atteints=${atteignables.join(",")}`
  );

  // Idempotence du journal d'envoi (la garde anti-doublon du cron).
  const dedupe = `rent_late_auto:${latePay.id}:J3`;
  const logRow = {
    user_id: uid,
    kind: "rent_late_auto",
    recipient: `e2e_nireo_${STAMP}_locataire@example.com`,
    subject: "",
    status: "sent",
    dedupe_key: dedupe,
  };
  const { error: log1 } = await c.from("email_logs").insert(logRow);
  const { error: log2 } = await c.from("email_logs").insert(logRow);
  check(
    "Relance : réservation idempotente (jamais deux fois le même jalon)",
    !log1 && !!log2,
    `1er=${log1?.message ?? "ok"} 2e=${log2?.message ?? "ACCEPTÉ (anti-doublon HS)"}`
  );

  /* ---------------------------------------------------------------- */
  /* 7. STORAGE — erreur puis REPRISE de l'envoi                        */
  /* ---------------------------------------------------------------- */
  // Tentative hors du dossier de l'utilisateur : doit être REFUSÉE.
  const badPath = `un-autre-utilisateur/${prop.id}/e2e.pdf`;
  const { error: badUp } = await c.storage
    .from("property-documents")
    .upload(badPath, new Blob(["x"]), { contentType: "application/pdf" });
  check("Storage : envoi hors du dossier du compte refusé", !!badUp, badUp?.message ?? "ACCEPTÉ");

  // Reprise immédiate au bon endroit : l'échec ne doit rien avoir cassé.
  const docPath = `${uid}/${prop.id}/e2e-document.pdf`;
  const { error: goodUp } = await c.storage
    .from("property-documents")
    .upload(docPath, new Blob(["document de recette"]), { contentType: "application/pdf" });
  if (!goodUp) storagePaths.push(["property-documents", docPath]);
  check("Storage : reprise après échec réussie", !goodUp, goodUp?.message);

  const { data: signed } = await c.storage.from("property-documents").createSignedUrl(docPath, 60);
  check("Storage : URL signée délivrée (bucket privé)", !!signed?.signedUrl);

  /* ---------------------------------------------------------------- */
  /* 8. DOCUMENT, DÉPENSE, TRAVAUX, PHOTO                               */
  /* ---------------------------------------------------------------- */
  const { data: doc, error: docErr } = await c
    .from("documents")
    .insert({
      owner_id: uid,
      property_id: prop.id,
      name: "E2E bail signé",
      category: "bail",
      file_path: docPath,
      size_bytes: 19,
      file_type: "pdf",
    })
    .select("id")
    .single();
  check("Document : création", !docErr && !!doc?.id, docErr?.message);
  await c.from("documents").update({ name: "E2E bail signé (modifié)" }).eq("id", doc.id);
  const { data: docRead } = await c.from("documents").select("name").eq("id", doc.id).single();
  check("Document : modification persistée", docRead?.name?.endsWith("(modifié)"));

  const { data: work, error: wErr } = await c
    .from("maintenance_records")
    .insert({
      owner_id: uid,
      property_id: prop.id,
      title: "E2E peinture",
      company: "Recette SARL",
      amount: 900,
      date: `${shiftMonth(new Date(), -1)}-05`,
      status: "en_cours",
    })
    .select("id")
    .single();
  check("Travaux : création", !wErr && !!work?.id, wErr?.message);
  await c.from("maintenance_records").update({ status: "termine" }).eq("id", work.id);

  const { data: exp, error: eErr } = await c
    .from("expenses")
    .insert({
      owner_id: uid,
      property_id: prop.id,
      label: "E2E peinture",
      category: "travaux",
      amount: 900,
      date: `${shiftMonth(new Date(), -1)}-05`,
      maintenance_record_id: work.id,
    })
    .select("id")
    .single();
  check("Dépense : création (liée au chantier)", !eErr && !!exp?.id, eErr?.message);
  await c.from("expenses").update({ amount: 850 }).eq("id", exp.id);
  const { data: expRead } = await c.from("expenses").select("amount").eq("id", exp.id).single();
  check("Dépense : modification persistée", Number(expRead?.amount) === 850);

  const photoPath = `${uid}/${prop.id}/e2e-photo.png`;
  const { error: phUp } = await c.storage
    .from("property-photos")
    .upload(photoPath, new Blob(["png"]), { contentType: "image/png" });
  if (!phUp) storagePaths.push(["property-photos", photoPath]);
  const { data: photo, error: phErr } = await c
    .from("property_photos")
    .insert({
      owner_id: uid,
      property_id: prop.id,
      file_path: photoPath,
      caption: "E2E salon",
      category: "entree",
      taken_at: `${shiftMonth(new Date(), -1)}-05`,
    })
    .select("id")
    .single();
  check(
    "Photo : fichier Storage + ligne créés (trigger owner OK)",
    !phUp && !phErr && !!photo?.id,
    `${phUp?.message ?? ""} ${phErr?.message ?? ""}`.trim()
  );

  /* ---------------------------------------------------------------- */
  /* 9. RLS — le compte ne voit QUE ses propres lignes                  */
  /* ---------------------------------------------------------------- */
  const tables = [
    "properties",
    "tenants",
    "leases",
    "rent_payments",
    "expenses",
    "maintenance_records",
    "documents",
    "property_photos",
  ];
  let fuite = null;
  for (const t of tables) {
    const { data: rows, error } = await c.from(t).select("id, owner_id");
    if (error) {
      fuite = `${t}: ${error.message}`;
      break;
    }
    const etranger = (rows ?? []).filter((r) => r.owner_id !== uid);
    if (etranger.length > 0) {
      fuite = `${t}: ${etranger.length} ligne(s) d'un autre propriétaire visibles`;
      break;
    }
  }
  check("RLS : aucune ligne d'un autre propriétaire n'est visible", fuite === null, fuite ?? "");

  // Le plan ne doit pas être modifiable par le client (élévation de quota).
  const { error: planErr } = await c.from("profiles").update({ plan: "business" }).eq("id", uid);
  const { data: planAfter } = await c.from("profiles").select("plan").eq("id", uid).single();
  check(
    "RLS : le plan n'est pas modifiable depuis le client",
    planAfter?.plan === "free",
    `erreur=${planErr?.message ?? "aucune"} plan=${planAfter?.plan}`
  );

  /* ---------------------------------------------------------------- */
  /* 10. SUPPRESSIONS applicatives                                      */
  /* ---------------------------------------------------------------- */
  await c.from("property_photos").delete().eq("id", photo.id);
  await c.from("documents").delete().eq("id", doc.id);
  await c.from("expenses").delete().eq("id", exp.id);
  await c.from("maintenance_records").delete().eq("id", work.id);
  await c.from("rent_payments").delete().eq("id", latePay.id);
  const { data: delLease } = await c
    .from("leases")
    .delete()
    .eq("id", lease.id)
    .select("property_id, tenant_id, exit_date")
    .single();
  if (delLease?.exit_date === null) {
    await c.from("properties").update({ status: "vacant" }).eq("id", delLease.property_id);
  }
  await c.from("tenants").delete().eq("id", tenant.id);
  const { data: propAfter } = await c.from("properties").select("status").eq("id", prop.id).single();
  check("Suppression du bail → logement redevenu vacant", propAfter?.status === "vacant");

  await c.from("properties").delete().eq("id", prop.id);
  const { count: restant } = await c
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid);
  check("Suppression du logement", restant === 0);
} catch (e) {
  check(`EXCEPTION : ${e.message}`, false);
} finally {
  /* ---------------------------------------------------------------- */
  /* 11. NETTOYAGE — fichiers, lignes, compte                           */
  /* ---------------------------------------------------------------- */
  if (uid) {
    for (const bucket of BUCKETS) {
      const { data: lvl1 } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
      for (const dir of lvl1 ?? []) {
        const { data: lvl2 } = await admin.storage
          .from(bucket)
          .list(`${uid}/${dir.name}`, { limit: 1000 });
        const paths = (lvl2 ?? []).map((f) => `${uid}/${dir.name}/${f.name}`);
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      }
    }
    // La suppression du compte cascade sur toutes les tables (on delete cascade).
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    check("Nettoyage : compte jetable supprimé", !delErr, delErr?.message);

    // Vérification de l'absence de résidu, table par table.
    const restes = [];
    for (const t of [
      "properties",
      "tenants",
      "leases",
      "rent_payments",
      "expenses",
      "maintenance_records",
      "documents",
      "property_photos",
      "email_logs",
      "notifications",
      "notification_preferences",
      "profiles",
    ]) {
      const col = t === "profiles" ? "id" : t.startsWith("email") || t === "notifications" || t === "notification_preferences" ? "user_id" : "owner_id";
      const { count } = await admin.from(t).select("*", { count: "exact", head: true }).eq(col, uid);
      if ((count ?? 0) > 0) restes.push(`${t}=${count}`);
    }
    let fichiers = 0;
    for (const bucket of BUCKETS) {
      const { data: lvl1 } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
      fichiers += (lvl1 ?? []).length;
    }
    check(
      "Nettoyage : aucune donnée de test résiduelle",
      restes.length === 0 && fichiers === 0,
      `tables=${restes.join(",") || "vides"} fichiers=${fichiers}`
    );
  }

  const ko = results.filter((r) => !r.ok);
  console.log(`\n${results.length - ko.length}/${results.length} vérifications réussies`);
  if (ko.length) {
    console.log("ÉCHECS :");
    for (const r of ko) console.log(`  - ${r.name}`);
  }
  process.exit(ko.length ? 1 : 0);
}
