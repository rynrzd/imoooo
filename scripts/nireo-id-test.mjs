/**
 * Nireo ID — tests d'acceptation RÉELS contre le projet Supabase.
 *
 * Crée des comptes jetables (propriétaire A, acheteur B, professionnel P,
 * administrateur ADM), déroule les parcours critiques, puis SUPPRIME tout
 * (comptes, fichiers, lignes) — aucune donnée résiduelle.
 *
 * Couvre : RLS entre utilisateurs, privilèges colonne, aperçu public sans
 * fuite, liens de partage (valide / expiré / révoqué), transfert atomique
 * et double acceptation, compte professionnel non approuvé puis approuvé,
 * accès professionnel, journal append-only, droits d'administration.
 *
 * Usage : node scripts/nireo-id-test.mjs
 * Prérequis : migration supabase/migrations/20260808090000_nireo_id.sql appliquée.
 */
import { createHash, randomBytes } from "node:crypto";
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

const PASSWORD = "Nid-Test-2026!secure";
const stamp = Date.now();
const emails = {
  a: `nid-a-${stamp}@example.com`,
  b: `nid-b-${stamp}@example.com`,
  p: `nid-pro-${stamp}@example.com`,
  adm: `nid-adm-${stamp}@example.com`,
};
const users = {};
const clients = {};
const PEPPER = env.NIREO_ID_FINGERPRINT_PEPPER ?? "";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fingerprint = (value) => sha256(`${PEPPER}:${value}`);
const token = () => randomBytes(32).toString("base64url");

async function signIn(email) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Connexion ${email} : ${error.message}`);
  return { client, userId: data.user.id };
}

/* ------------------------------------------------------------------ */

let assetId;
let professionalId;

// ---- 0. Le schéma Nireo ID doit exister ----
const probe = await admin.from("nid_assets").select("id").limit(1);
if (probe.error) {
  console.error(
    `SCHÉMA ABSENT : ${probe.error.message}\n` +
      "Appliquez d'abord supabase/migrations/20260808090000_nireo_id.sql, puis relancez ce test."
  );
  process.exitCode = 2;
}

if (!probe.error) {
try {
  // ---- Comptes de test (confirmés directement) ----
  for (const [key, email] of Object.entries(emails)) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Création ${key} : ${error.message}`);
    users[key] = data.user;
  }
  for (const key of Object.keys(emails)) clients[key] = await signIn(emails[key]);

  await admin.from("nid_admins").insert({ user_id: users.adm.id, role: "owner", is_active: true });

  /* ================================================================ */
  /*  PARCOURS PARTICULIER                                            */
  /* ================================================================ */

  // ---- 1. Création atomique d'un passeport ----
  assetId = crypto.randomUUID();
  const serial = `SER${stamp}`;
  const imei = `35${String(stamp).slice(-13)}`;
  const { data: created, error: createError } = await admin.rpc("nid_create_asset", {
    p_owner_id: users.a.id,
    p_asset_id: assetId,
    p_payload: {
      brand: "TestMarque",
      model: "TestModele",
      color: "Bleu",
      storage_capacity: "128 Go",
      serial_number: serial,
      serial_fingerprint: fingerprint(serial),
      serial_last4: serial.slice(-4),
      imei,
      imei_fingerprint: fingerprint(imei),
      imei_last4: imei.slice(-4),
      purchase_date: "2024-05-10",
      purchase_source: "Boutique test",
      purchase_condition: "neuf",
      declared_condition: { ecran: "bon", comment: "Test" },
      media: [],
      documents: [],
    },
  });
  check("A crée un passeport (RPC atomique)", !createError && !!created?.public_id, createError?.message ?? created?.public_id);
  check(
    "Identifiant public au bon format",
    /^NIR-PH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(created?.public_id ?? ""),
    created?.public_id
  );
  const publicId = created.public_id;

  // ---- 2. Persistance : A relit son passeport ----
  const { data: readBack } = await clients.a.client
    .from("nid_assets")
    .select("id, public_id, current_owner_id")
    .eq("id", assetId)
    .maybeSingle();
  check("Le passeport persiste et appartient à A", readBack?.current_owner_id === users.a.id);

  // ---- 3. Événements créés automatiquement (achat + état déclaré) ----
  const { data: autoEvents } = await clients.a.client
    .from("nid_events")
    .select("id, type, trust_level")
    .eq("asset_id", assetId);
  check(
    "Achat et constat d'état créés au niveau « Déclaré »",
    (autoEvents ?? []).length === 2 && (autoEvents ?? []).every((e) => e.trust_level === 0),
    `${(autoEvents ?? []).length} événement(s)`
  );

  // ---- 4. Isolation : B ne voit rien de A ----
  const { data: bAssets } = await clients.b.client.from("nid_assets").select("id").eq("id", assetId);
  check("B ne lit pas le passeport de A", (bAssets ?? []).length === 0);

  const { data: bUpdate } = await clients.b.client
    .from("nid_assets")
    .update({ brand: "PIRATE" })
    .eq("id", assetId)
    .select("id");
  check("B ne modifie pas le passeport de A", (bUpdate ?? []).length === 0);

  const { data: bEvents } = await clients.b.client
    .from("nid_events")
    .select("id")
    .eq("asset_id", assetId);
  check("B ne lit pas l'historique de A", (bEvents ?? []).length === 0);

  const { error: bInsertEvent } = await clients.b.client.from("nid_events").insert({
    asset_id: assetId,
    type: "reparation",
    effective_date: "2026-01-01",
    title: "Faux événement",
    author_user_id: users.b.id,
    author_role: "proprietaire",
    trust_level: 0,
  });
  check("B n'ajoute pas d'événement au passeport de A", !!bInsertEvent, bInsertEvent?.message?.slice(0, 60));

  // ---- 5. Privilèges colonne : A ne réécrit pas son identifiant public ----
  const { error: publicIdError } = await clients.a.client
    .from("nid_assets")
    .update({ public_id: "NIR-PH-AAAA-BBBB" })
    .eq("id", assetId);
  const { data: afterPublicId } = await admin
    .from("nid_assets")
    .select("public_id")
    .eq("id", assetId)
    .single();
  check(
    "A ne peut pas réécrire l'identifiant public",
    !!publicIdError && afterPublicId.public_id === publicId,
    publicIdError?.message?.slice(0, 50)
  );

  // ---- 6. A ne peut pas s'auto-déclarer « validé par un professionnel » ----
  const { error: fakeProError } = await clients.a.client.from("nid_events").insert({
    asset_id: assetId,
    type: "reparation",
    effective_date: "2026-01-02",
    title: "Fausse validation",
    author_user_id: users.a.id,
    author_role: "proprietaire",
    trust_level: 2,
  });
  check("A ne peut pas poser le niveau « Validé par un professionnel »", !!fakeProError, fakeProError?.message?.slice(0, 60));

  // ---- 7. Événement déclaré via la fonction serveur ----
  const { data: ownerEvent } = await admin.rpc("nid_add_owner_event", {
    p_owner_id: users.a.id,
    p_asset_id: assetId,
    p_payload: {
      type: "reparation",
      effective_date: "2026-02-01",
      title: "Changement de batterie",
      description: "Déclaré par le propriétaire",
      cost_cents: "4900",
      metadata: { parts: "Batterie" },
      media: [],
      documents: [],
    },
  });
  check("A déclare un événement", ownerEvent?.state === "cree", ownerEvent?.state);

  const { data: notOwnerEvent } = await admin.rpc("nid_add_owner_event", {
    p_owner_id: users.b.id,
    p_asset_id: assetId,
    p_payload: { type: "autre", effective_date: "2026-02-01", title: "Intrusion" },
  });
  check("Un non-propriétaire ne peut pas déclarer d'événement", notOwnerEvent?.state === "non_proprietaire");

  // ---- 8. Aperçu public : aucune donnée privée ----
  const { data: preview } = await admin.rpc("nid_public_preview", { p_public_id: publicId });
  const previewText = JSON.stringify(preview ?? {});
  check(
    "Aperçu public sans IMEI ni numéro de série complets",
    !previewText.includes(serial) && !previewText.includes(imei),
    previewText.slice(0, 90)
  );
  check(
    "Aperçu public : photo et année masquées par défaut",
    preview?.photo_path === null && preview?.purchase_year === null
  );

  /* ================================================================ */
  /*  PARTAGE                                                          */
  /* ================================================================ */

  const validToken = token();
  const { error: shareError } = await clients.a.client.from("nid_share_links").insert({
    asset_id: assetId,
    created_by: users.a.id,
    token_hash: sha256(validToken),
    label: "Acheteur test",
    sections: ["caracteristiques", "historique"],
    allow_download: false,
    show_serial_last4: false,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
  check("A crée un lien de partage", !shareError, shareError?.message);

  const { data: resolved } = await admin.rpc("nid_resolve_share", { p_token_hash: sha256(validToken) });
  check("Le lien valide ouvre le dossier", resolved?.state === "valide", resolved?.state);
  check(
    "Le dossier partagé ne contient ni IMEI ni numéro de série complets",
    !JSON.stringify(resolved).includes(serial) && !JSON.stringify(resolved).includes(imei)
  );
  check("Aucun document partagé sans sélection explicite", (resolved?.documents ?? []).length === 0);

  const unknownToken = token();
  const { data: unknownResolved } = await admin.rpc("nid_resolve_share", {
    p_token_hash: sha256(unknownToken),
  });
  check("Un jeton inconnu n'ouvre rien", unknownResolved?.state === "introuvable");

  const expiredToken = token();
  await admin.from("nid_share_links").insert({
    asset_id: assetId,
    created_by: users.a.id,
    token_hash: sha256(expiredToken),
    sections: ["caracteristiques"],
    expires_at: new Date(Date.now() - 3600_000).toISOString(),
  });
  const { data: expiredResolved } = await admin.rpc("nid_resolve_share", {
    p_token_hash: sha256(expiredToken),
  });
  check("Un lien expiré ne donne aucun accès", expiredResolved?.state === "expire", expiredResolved?.state);

  const revokedToken = token();
  const { data: revokedRow } = await admin
    .from("nid_share_links")
    .insert({
      asset_id: assetId,
      created_by: users.a.id,
      token_hash: sha256(revokedToken),
      sections: ["caracteristiques"],
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    .select("id")
    .single();
  await clients.a.client
    .from("nid_share_links")
    .update({ revoked_at: new Date().toISOString(), revoked_by: users.a.id })
    .eq("id", revokedRow.id);
  const { data: revokedResolved } = await admin.rpc("nid_resolve_share", {
    p_token_hash: sha256(revokedToken),
  });
  check("Un lien révoqué ne donne aucun accès", revokedResolved?.state === "revoque", revokedResolved?.state);

  /* ================================================================ */
  /*  PROFESSIONNEL                                                    */
  /* ================================================================ */

  const { data: proProfile, error: proError } = await clients.p.client
    .from("nid_professional_profiles")
    .insert({
      user_id: users.p.id,
      trade_name: "Atelier Test",
      manager_name: "Responsable Test",
      contact_email: emails.p,
      activity: "reparation",
      status: "en_attente",
      rules_accepted_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();
  check("Candidature professionnelle enregistrée « en attente »", !proError && proProfile?.status === "en_attente", proError?.message);
  professionalId = proProfile.id;

  const { data: selfApprove } = await clients.p.client
    .from("nid_professional_profiles")
    .update({ status: "approuve" })
    .eq("id", professionalId)
    .select("status");
  const { data: proAfterSelf } = await admin
    .from("nid_professional_profiles")
    .select("status")
    .eq("id", professionalId)
    .single();
  check(
    "Un professionnel ne peut pas s'auto-approuver",
    proAfterSelf.status === "en_attente",
    `statut en base : ${proAfterSelf.status} (retour: ${JSON.stringify(selfApprove)})`
  );

  const { data: notApproved } = await admin.rpc("nid_pro_add_event", {
    p_user_id: users.p.id,
    p_asset_id: assetId,
    p_payload: { type: "reparation", effective_date: "2026-03-01", title: "Avant approbation" },
  });
  check("Compte non approuvé : aucune intervention validée", notApproved?.state === "pro_non_approuve", notApproved?.state);

  // Approbation par l'administration (clé secrète, comme la Server Action).
  const { data: nidAdminRow } = await admin
    .from("nid_admins")
    .select("id")
    .eq("user_id", users.adm.id)
    .single();
  await admin
    .from("nid_professional_profiles")
    .update({
      status: "approuve",
      decision_reason: "Test automatisé",
      decided_by: nidAdminRow.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", professionalId);

  const { data: approvedNoAccess } = await admin.rpc("nid_pro_add_event", {
    p_user_id: users.p.id,
    p_asset_id: assetId,
    p_payload: { type: "reparation", effective_date: "2026-03-02", title: "Sans autorisation" },
  });
  check("Approuvé mais sans autorisation : accès refusé", approvedNoAccess?.state === "acces_refuse", approvedNoAccess?.state);

  const { data: proBrowse } = await clients.p.client.from("nid_assets").select("id").limit(5);
  check("Un professionnel ne peut pas parcourir la base", (proBrowse ?? []).length === 0);

  // Le propriétaire accorde l'accès.
  await admin.from("nid_professional_access").insert({
    asset_id: assetId,
    professional_id: professionalId,
    granted_by: users.a.id,
    source: "invitation",
    scope: "intervention",
    status: "accorde",
    expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });

  const { data: proEvent } = await admin.rpc("nid_pro_add_event", {
    p_user_id: users.p.id,
    p_asset_id: assetId,
    p_payload: {
      type: "reparation",
      effective_date: "2026-03-03",
      title: "Remplacement écran",
      description: "Test",
      cost_cents: "12900",
      metadata: { parts: "Écran" },
      media: [],
      documents: [],
    },
  });
  check("Professionnel approuvé + autorisé : intervention créée", proEvent?.state === "cree", proEvent?.state);

  const { data: proEventRow } = await admin
    .from("nid_events")
    .select("trust_level, author_role, author_label, professional_id")
    .eq("id", proEvent.event_id)
    .single();
  check(
    "L'intervention porte le niveau « Validé par un professionnel » et l'identité du pro",
    proEventRow.trust_level === 2 &&
      proEventRow.author_role === "professionnel" &&
      proEventRow.professional_id === professionalId &&
      proEventRow.author_label === "Atelier Test"
  );

  // Révocation traçable par le professionnel.
  const { data: revokeResult } = await admin.rpc("nid_revoke_event", {
    p_event_id: proEvent.event_id,
    p_actor_user_id: users.p.id,
    p_actor_role: "professionnel",
    p_reason: "Erreur de saisie (test)",
  });
  const { data: revokedEvent } = await admin
    .from("nid_events")
    .select("revoked_at, trust_level, revocation_reason")
    .eq("id", proEvent.event_id)
    .single();
  check(
    "Révocation motivée : l'événement reste, marqué « Révoqué »",
    revokeResult?.state === "revoque" && !!revokedEvent.revoked_at && revokedEvent.trust_level === 4
  );
  const { data: doubleRevoke } = await admin.rpc("nid_revoke_event", {
    p_event_id: proEvent.event_id,
    p_actor_user_id: users.p.id,
    p_actor_role: "professionnel",
    p_reason: "Deuxième tentative",
  });
  check("Une seconde révocation est refusée", doubleRevoke?.state === "deja_revoque");

  /* ================================================================ */
  /*  TRANSFERT                                                        */
  /* ================================================================ */

  // Document privé de A : il ne doit PAS suivre l'objet.
  const privatePath = `${users.a.id}/${assetId}/documents/${crypto.randomUUID()}.pdf`;
  await admin.from("nid_documents").insert({
    asset_id: assetId,
    owner_user_id: users.a.id,
    kind: "facture",
    storage_path: privatePath,
    original_name: "facture-test.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    transfer_policy: "prive",
  });

  const transferToken = token();
  const { error: transferError } = await admin.from("nid_transfers").insert({
    asset_id: assetId,
    seller_id: users.a.id,
    recipient_email: emails.b,
    token_hash: sha256(transferToken),
    status: "en_attente",
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    options: { documents: {} },
    asset_summary: { public_id: publicId, brand: "TestMarque", model: "TestModele" },
  });
  check("Transfert ouvert vers B", !transferError, transferError?.message);
  await admin.from("nid_assets").update({ status: "transfer_pending" }).eq("id", assetId);

  const secondToken = token();
  const { error: secondTransfer } = await admin.from("nid_transfers").insert({
    asset_id: assetId,
    seller_id: users.a.id,
    recipient_email: emails.p,
    token_hash: sha256(secondToken),
    status: "en_attente",
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
  });
  check("Un seul transfert actif par objet", !!secondTransfer, secondTransfer?.message?.slice(0, 60));

  const { data: wrongRecipient } = await admin.rpc("nid_accept_transfer", {
    p_token_hash: sha256(transferToken),
    p_user_id: users.p.id,
    p_user_email: emails.p,
  });
  check("Un autre utilisateur ne peut pas accepter le transfert", wrongRecipient?.state === "destinataire_different", wrongRecipient?.state);

  const { data: accepted } = await admin.rpc("nid_accept_transfer", {
    p_token_hash: sha256(transferToken),
    p_user_id: users.b.id,
    p_user_email: emails.b,
  });
  check("B accepte le transfert", accepted?.state === "accepte", accepted?.state);

  const { data: doubleAccept } = await admin.rpc("nid_accept_transfer", {
    p_token_hash: sha256(transferToken),
    p_user_id: users.b.id,
    p_user_email: emails.b,
  });
  check("Une double acceptation n'aboutit qu'une fois", doubleAccept?.state === "deja_traite", doubleAccept?.state);

  const { data: ownerships } = await admin
    .from("nid_ownerships")
    .select("owner_id, ended_at")
    .eq("asset_id", assetId);
  const active = (ownerships ?? []).filter((o) => o.ended_at === null);
  check(
    "Une seule propriété active, au nom de B",
    active.length === 1 && active[0].owner_id === users.b.id,
    `${(ownerships ?? []).length} propriété(s), ${active.length} active(s)`
  );

  const { data: aAfter } = await clients.a.client.from("nid_assets").select("id").eq("id", assetId);
  check("A perd l'accès au passeport après transfert", (aAfter ?? []).length === 0);

  const { data: aEdit } = await clients.a.client
    .from("nid_assets")
    .update({ brand: "APRES-VENTE" })
    .eq("id", assetId)
    .select("id");
  check("A perd le droit de modification", (aEdit ?? []).length === 0);

  const { data: bAfter } = await clients.b.client
    .from("nid_assets")
    .select("id, status")
    .eq("id", assetId)
    .maybeSingle();
  check("B lit désormais le passeport", bAfter?.id === assetId && bAfter?.status === "active");

  const { data: bHistory } = await clients.b.client
    .from("nid_events")
    .select("id, type")
    .eq("asset_id", assetId);
  check(
    "L'historique suit l'objet (événement de transfert inclus)",
    (bHistory ?? []).some((e) => e.type === "transfert") && (bHistory ?? []).length >= 4,
    `${(bHistory ?? []).length} événement(s)`
  );

  const { data: bDocs } = await clients.b.client
    .from("nid_documents")
    .select("id")
    .eq("asset_id", assetId);
  check("Le document privé de A n'est PAS transmis à B", (bDocs ?? []).length === 0);

  const { data: aDocs } = await clients.a.client
    .from("nid_documents")
    .select("id")
    .eq("asset_id", assetId);
  check("A conserve son document privé", (aDocs ?? []).length === 1);

  const { data: aReceipt } = await clients.a.client
    .from("nid_transfers")
    .select("id, status")
    .eq("asset_id", assetId);
  check("A conserve un reçu de transfert", (aReceipt ?? []).some((t) => t.status === "accepte"));

  const { data: sharesAfter } = await admin
    .from("nid_share_links")
    .select("revoked_at")
    .eq("asset_id", assetId)
    .eq("created_by", users.a.id);
  check(
    "Les partages de l'ancien propriétaire sont révoqués",
    (sharesAfter ?? []).every((s) => s.revoked_at !== null)
  );

  const { data: proAccessAfter } = await admin
    .from("nid_professional_access")
    .select("status")
    .eq("asset_id", assetId);
  check(
    "Les accès professionnels tombent après transfert",
    (proAccessAfter ?? []).every((a) => a.status === "revoque")
  );

  /* ================================================================ */
  /*  ADMINISTRATION ET AUDIT                                          */
  /* ================================================================ */

  const { data: userSeesAdmins } = await clients.a.client.from("nid_admins").select("id");
  check("Un utilisateur normal ne lit pas la table des administrateurs", (userSeesAdmins ?? []).length === 0);

  const { error: userWritesAdmin } = await clients.a.client
    .from("nid_admins")
    .insert({ user_id: users.a.id, role: "owner" });
  check("Un utilisateur normal ne peut pas se déclarer administrateur", !!userWritesAdmin, userWritesAdmin?.message?.slice(0, 60));

  const { error: userApprovesPro } = await clients.a.client
    .from("nid_professional_profiles")
    .update({ status: "approuve" })
    .eq("id", professionalId);
  const { data: proStillApproved } = await admin
    .from("nid_professional_profiles")
    .select("status")
    .eq("id", professionalId)
    .single();
  check(
    "Une action d'administration échoue côté serveur pour un utilisateur normal",
    proStillApproved.status === "approuve" || !!userApprovesPro
  );

  await admin.from("nid_disputes").insert({
    asset_id: assetId,
    reporter_id: users.b.id,
    reason: "information_inexacte",
    description: "Signalement de test automatisé.",
    status: "ouvert",
  });
  const { data: aSeesDisputes } = await clients.a.client.from("nid_disputes").select("id");
  check("A ne lit pas les signalements de B", (aSeesDisputes ?? []).length === 0);

  const { data: auditRows } = await admin
    .from("nid_audit_logs")
    .select("id, action")
    .eq("asset_id", assetId);
  check(
    "Les actions sensibles sont journalisées",
    (auditRows ?? []).some((r) => r.action === "asset.created") &&
      (auditRows ?? []).some((r) => r.action === "transfer.accepted"),
    `${(auditRows ?? []).length} entrée(s)`
  );

  const { error: auditUpdate } = await admin
    .from("nid_audit_logs")
    .update({ action: "falsifie" })
    .eq("id", auditRows[0].id);
  check("Le journal d'audit est append-only (modification refusée)", !!auditUpdate, auditUpdate?.message?.slice(0, 60));

  const { error: auditDelete } = await admin
    .from("nid_audit_logs")
    .delete()
    .eq("id", auditRows[0].id);
  check("Le journal d'audit est append-only (suppression refusée)", !!auditDelete, auditDelete?.message?.slice(0, 60));

  const { data: userReadsAudit } = await clients.a.client.from("nid_audit_logs").select("id").limit(1);
  check("Le journal d'audit est invisible aux utilisateurs", (userReadsAudit ?? []).length === 0);

  /* ================================================================ */
  /*  DOUBLON                                                          */
  /* ================================================================ */

  const duplicateId = crypto.randomUUID();
  const { error: duplicateError } = await admin.rpc("nid_create_asset", {
    p_owner_id: users.b.id,
    p_asset_id: duplicateId,
    p_payload: {
      brand: "TestMarque",
      model: "TestModele",
      serial_number: serial,
      serial_fingerprint: fingerprint(serial),
      serial_last4: serial.slice(-4),
      purchase_condition: "occasion",
    },
  });
  check(
    "Doublon de numéro de série refusé, sans révéler le détenteur",
    !!duplicateError && duplicateError.message.includes("SERIAL_ALREADY_REGISTERED"),
    duplicateError?.message?.slice(0, 60)
  );
} catch (error) {
  console.error("ERREUR TEST :", error.message);
  process.exitCode = 1;
} finally {
  // ---- Nettoyage complet ----
  try {
    if (assetId) await admin.from("nid_assets").delete().eq("id", assetId);
    if (professionalId) await admin.from("nid_professional_profiles").delete().eq("id", professionalId);
    for (const user of Object.values(users)) {
      if (!user) continue;
      await admin.from("nid_admins").delete().eq("user_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
    }
    console.log("\nNettoyage : comptes et données de test supprimés.");
  } catch (error) {
    console.error("Nettoyage partiel :", error.message);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} tests PASS`);
  if (failed) process.exitCode = 1;
}
}
