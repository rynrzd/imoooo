/**
 * Nireo ID V2 — tests d'acceptation RÉELS contre le projet Supabase.
 *
 * Complète scripts/nireo-id-test.mjs (V1, toujours valable) : espaces et
 * rôles, affectations, bilans à jeton, réparations, provenance, quotas,
 * rapport partagé et séparation des administrations.
 *
 * Crée des comptes jetables, déroule les parcours, puis SUPPRIME tout.
 *
 * Usage : node scripts/nireo-id-v2-test.mjs
 * Prérequis : migrations 20260808090000_nireo_id.sql ET
 *             20260809090000_nireo_id_v2.sql appliquées.
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

const PASSWORD = "Nid-V2-2026!secure";
const stamp = Date.now();
const emails = {
  owner: `nid2-owner-${stamp}@example.com`,
  manager: `nid2-mgr-${stamp}@example.com`,
  member: `nid2-mbr-${stamp}@example.com`,
  outsider: `nid2-out-${stamp}@example.com`,
  repairer: `nid2-rep-${stamp}@example.com`,
};
const users = {};
const clients = {};
const PEPPER = env.NIREO_ID_FINGERPRINT_PEPPER ?? "";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fingerprint = (value) => sha256(`${PEPPER}:${value}`);
const newToken = () => randomBytes(32).toString("base64url");
const today = () => new Date().toISOString().slice(0, 10);

async function signIn(email) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Connexion ${email} : ${error.message}`);
  return { client, userId: data.user.id };
}

/** Crée un téléphone dans un espace donné (chemin applicatif réel). */
async function createPhone({ ownerId, workspaceId, brand, model, serial }) {
  const assetId = crypto.randomUUID();
  const { data, error } = await admin.rpc("nid_create_asset_v2", {
    p_owner_id: ownerId,
    p_asset_id: assetId,
    p_workspace_id: workspaceId,
    p_payload: {
      brand,
      model,
      color: "Noir",
      storage_capacity: "128 Go",
      serial_number: serial,
      serial_fingerprint: fingerprint(serial),
      serial_last4: serial.slice(-4),
      purchase_date: "2025-01-15",
      purchase_condition: "neuf",
      warranty_end: "2027-01-15",
      internal_reference: "PARC-TEST",
      check_frequency_months: "1",
      media: [],
      documents: [],
    },
  });
  if (error) throw new Error(`Création ${brand} ${model} : ${error.message}`);
  return { id: assetId, public_id: data.public_id, next_check_on: data.next_check_on };
}

let companyId;
let personalOwnerId;
let companyPhone;
let personalPhone;
let repairOrderId;

/* ------------------------------------------------------------------ */

// ---- 0. Le schéma V2 doit exister ----
const probe = await admin.from("nid_workspaces").select("id").limit(1);
if (probe.error) {
  console.error(
    `SCHÉMA V2 ABSENT : ${probe.error.message}\n` +
      "Appliquez supabase/migrations/20260809090000_nireo_id_v2.sql, puis relancez ce test."
  );
  process.exitCode = 2;
}

if (!probe.error) {
  try {
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

    /* ================================================================ */
    /*  1. ESPACES ET RÔLES                                             */
    /* ================================================================ */

    // ---- 1. Espace personnel atomique et idempotent ----
    const { data: personal1 } = await admin.rpc("nid_ensure_personal_workspace", {
      p_user_id: users.owner.id,
      p_name: "Espace de test",
    });
    const { data: personal2 } = await admin.rpc("nid_ensure_personal_workspace", {
      p_user_id: users.owner.id,
      p_name: "Espace de test",
    });
    personalOwnerId = personal1;
    check(
      "Espace personnel créé une seule fois (atomique et idempotent)",
      Boolean(personal1) && personal1 === personal2,
      `${personal1} / ${personal2}`
    );

    for (const key of ["manager", "member", "outsider", "repairer"]) {
      await admin.rpc("nid_ensure_personal_workspace", {
        p_user_id: users[key].id,
        p_name: `Espace ${key}`,
      });
    }

    // ---- 2. Isolation RLS entre deux particuliers ----
    personalPhone = await createPhone({
      ownerId: users.owner.id,
      workspaceId: personalOwnerId,
      brand: "TestPerso",
      model: "P1",
      serial: `PERSO${stamp}`,
    });
    const { data: ownerSees } = await clients.owner.client
      .from("nid_assets")
      .select("id")
      .eq("id", personalPhone.id);
    const { data: outsiderSees } = await clients.outsider.client
      .from("nid_assets")
      .select("id")
      .eq("id", personalPhone.id);
    check(
      "Un particulier voit son téléphone, un autre ne le voit pas",
      (ownerSees ?? []).length === 1 && (outsiderSees ?? []).length === 0
    );

    // ---- 3. Création d'une entreprise ----
    const { data: company, error: companyError } = await admin.rpc("nid_create_workspace", {
      p_user_id: users.owner.id,
      p_kind: "entreprise",
      p_name: `Entreprise Test ${stamp}`,
    });
    companyId = company?.id;
    check("Entreprise créée avec son propriétaire", Boolean(companyId), companyError?.message);

    // ---- 4. Rôles ----
    await admin.from("nid_workspace_members").insert([
      { workspace_id: companyId, user_id: users.manager.id, role: "manager", status: "actif" },
      { workspace_id: companyId, user_id: users.member.id, role: "member", status: "actif" },
    ]);
    const { data: roles } = await admin
      .from("nid_workspace_members")
      .select("user_id, role")
      .eq("workspace_id", companyId);
    check(
      "Rôles owner, manager et member enregistrés",
      (roles ?? []).length === 3 &&
        roles.some((r) => r.role === "owner") &&
        roles.some((r) => r.role === "manager") &&
        roles.some((r) => r.role === "member")
    );

    companyPhone = await createPhone({
      ownerId: users.owner.id,
      workspaceId: companyId,
      brand: "TestPro",
      model: "E1",
      serial: `ENT${stamp}`,
    });

    const secondPhone = await createPhone({
      ownerId: users.owner.id,
      workspaceId: companyId,
      brand: "TestPro",
      model: "E2",
      serial: `ENT2${stamp}`,
    });

    // ---- 5. Un non-membre ne voit pas le parc ----
    const { data: outsiderFleet } = await clients.outsider.client
      .from("nid_assets")
      .select("id")
      .eq("workspace_id", companyId);
    check("Un non-membre ne voit aucun téléphone de l'entreprise", (outsiderFleet ?? []).length === 0);

    const { data: managerFleet } = await clients.manager.client
      .from("nid_assets")
      .select("id")
      .eq("workspace_id", companyId);
    check("Un manager voit le parc de son entreprise", (managerFleet ?? []).length === 2);

    /* ================================================================ */
    /*  2. AFFECTATIONS                                                 */
    /* ================================================================ */

    // ---- 6 et 7. Propriété distincte de l'affectation ----
    const { data: assignResult } = await admin.rpc("nid_assign_asset", {
      p_actor_id: users.manager.id,
      p_asset_id: companyPhone.id,
      p_workspace_id: companyId,
      p_payload: {
        holder_user_id: users.member.id,
        holder_name: "Emma Test",
        holder_email: emails.member,
        kind: "affectation",
        note: "Commentaire interne de test",
      },
    });
    check("Affectation enregistrée par le manager", assignResult?.state === "affecte", assignResult?.state);

    const { data: afterAssign } = await admin
      .from("nid_assets")
      .select("current_owner_id, fleet_status")
      .eq("id", companyPhone.id)
      .single();
    const { count: ownershipCount } = await admin
      .from("nid_ownerships")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", companyPhone.id);
    check(
      "L'affectation ne transfère AUCUNE propriété",
      afterAssign.current_owner_id === users.owner.id &&
        afterAssign.fleet_status === "affecte" &&
        ownershipCount === 1
    );

    // Le membre voit son téléphone affecté, pas les autres.
    const { data: memberSees } = await clients.member.client.from("nid_assets").select("id");
    check(
      "Un salarié voit uniquement le téléphone qui lui est affecté",
      (memberSees ?? []).length === 1 && memberSees[0].id === companyPhone.id
    );

    const { data: assignmentRow } = await admin
      .from("nid_assignments")
      .select("id, note")
      .eq("asset_id", companyPhone.id)
      .eq("status", "active")
      .single();

    const { data: endResult } = await admin.rpc("nid_end_assignment", {
      p_actor_id: users.manager.id,
      p_assignment_id: assignmentRow.id,
      p_fleet_status: "en_stock",
    });
    const { data: afterReturn } = await admin
      .from("nid_assets")
      .select("current_owner_id, fleet_status")
      .eq("id", companyPhone.id)
      .single();
    const { count: ownershipAfterReturn } = await admin
      .from("nid_ownerships")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", companyPhone.id);
    check(
      "Le retour ne change ni la propriété ni l'historique",
      endResult?.state === "termine" &&
        afterReturn.current_owner_id === users.owner.id &&
        afterReturn.fleet_status === "en_stock" &&
        ownershipAfterReturn === 1
    );

    // ---- 8. Salarié enregistré sans compte ----
    const { error: noAccountError } = await admin.from("nid_workspace_members").insert({
      workspace_id: companyId,
      user_id: null,
      email: `sans-compte-${stamp}@example.com`,
      display_name: "Salarié sans compte",
      role: "member",
      status: "invite",
    });
    const { data: assignNoAccount } = await admin.rpc("nid_assign_asset", {
      p_actor_id: users.manager.id,
      p_asset_id: secondPhone.id,
      p_workspace_id: companyId,
      p_payload: {
        holder_name: "Salarié sans compte",
        holder_email: `sans-compte-${stamp}@example.com`,
        kind: "affectation",
      },
    });
    check(
      "Un salarié sans compte peut être enregistré et recevoir un téléphone",
      !noAccountError && assignNoAccount?.state === "affecte",
      noAccountError?.message ?? assignNoAccount?.state
    );

    // Aucun nom de salarié dans l'historique partageable.
    const { data: assignEvents } = await admin
      .from("nid_events")
      .select("title, description")
      .eq("asset_id", companyPhone.id);
    check(
      "L'historique ne contient jamais le nom du détenteur",
      (assignEvents ?? []).every(
        (event) => !`${event.title} ${event.description}`.includes("Emma Test")
      )
    );

    /* ================================================================ */
    /*  3. BILANS                                                       */
    /* ================================================================ */

    // ---- 9. Jeton valide ----
    const checkToken = newToken();
    const { data: requestResult } = await admin.rpc("nid_create_check_request", {
      p_asset_id: companyPhone.id,
      p_token_hash: sha256(checkToken),
      p_payload: {
        workspace_id: companyId,
        recipient_user_id: users.member.id,
        recipient_name: "Emma Test",
        recipient_email: emails.member,
        scope: "mini",
        due_on: today(),
        expires_at: new Date(Date.now() + 45 * 86400_000).toISOString(),
        created_by: users.manager.id,
      },
    });
    check("Demande de bilan créée avec un jeton haché", requestResult?.state === "creee");

    const { data: rawRequest } = await admin
      .from("nid_check_requests")
      .select("token_hash")
      .eq("id", requestResult.id)
      .single();
    check(
      "Le jeton n'est jamais stocké en clair",
      rawRequest.token_hash === sha256(checkToken) && rawRequest.token_hash !== checkToken
    );

    // Idempotence de la création (relance du cron).
    const { data: secondRequest } = await admin.rpc("nid_create_check_request", {
      p_asset_id: companyPhone.id,
      p_token_hash: sha256(newToken()),
      p_payload: {
        workspace_id: companyId,
        recipient_email: emails.member,
        due_on: today(),
      },
    });
    check(
      "Relancer le planificateur ne crée pas un second bilan (aucun doublon d'e-mail)",
      secondRequest?.state === "existante" && secondRequest.id === requestResult.id
    );

    // ---- 10. Jeton expiré ----
    const expiredToken = newToken();
    await admin.rpc("nid_create_check_request", {
      p_asset_id: secondPhone.id,
      p_token_hash: sha256(expiredToken),
      p_payload: {
        workspace_id: companyId,
        recipient_email: emails.member,
        due_on: "2026-01-01",
        expires_at: new Date(Date.now() - 86400_000).toISOString(),
      },
    });
    const { data: expiredAnswer } = await admin.rpc("nid_answer_checkup", {
      p_token_hash: sha256(expiredToken),
      p_user_id: users.member.id,
      p_payload: { answer: "tout_fonctionne", details: {}, comment: "" },
    });
    check("Un jeton expiré est refusé", expiredAnswer?.state === "expire", expiredAnswer?.state);

    // ---- 11. Jeton révoqué ----
    const revokedToken = newToken();
    const { data: revokedRequest } = await admin.rpc("nid_create_check_request", {
      p_asset_id: secondPhone.id,
      p_token_hash: sha256(revokedToken),
      p_payload: {
        workspace_id: companyId,
        recipient_email: emails.member,
        due_on: "2026-02-01",
      },
    });
    await admin
      .from("nid_check_requests")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", revokedRequest.id);
    const { data: revokedAnswer } = await admin.rpc("nid_answer_checkup", {
      p_token_hash: sha256(revokedToken),
      p_user_id: users.member.id,
      p_payload: { answer: "tout_fonctionne", details: {}, comment: "" },
    });
    check("Un jeton révoqué est refusé", revokedAnswer?.state === "revoque", revokedAnswer?.state);

    // ---- 12 et 13. Réponse « tout va bien » puis double soumission ----
    const { data: answer1 } = await admin.rpc("nid_answer_checkup", {
      p_token_hash: sha256(checkToken),
      p_user_id: users.member.id,
      p_payload: { answer: "tout_fonctionne", details: {}, comment: "" },
    });
    check("Réponse « tout fonctionne » enregistrée", answer1?.state === "enregistre", answer1?.state);

    const { data: answer2 } = await admin.rpc("nid_answer_checkup", {
      p_token_hash: sha256(checkToken),
      p_user_id: users.member.id,
      p_payload: { answer: "probleme", details: {}, comment: "double clic" },
    });
    const { count: checkupCount } = await admin
      .from("nid_checkups")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", companyPhone.id);
    check(
      "Double soumission idempotente : une seule réponse enregistrée",
      answer2?.state === "deja_repondu" && checkupCount === 1,
      `${answer2?.state} / ${checkupCount}`
    );

    // ---- 15 et 21. Événement append-only avec provenance ----
    const { data: checkupEvent } = await admin
      .from("nid_events")
      .select("id, type, source_type, author_label, title")
      .eq("asset_id", companyPhone.id)
      .eq("type", "controle_etat")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    check(
      "Le bilan crée un événement daté avec sa provenance « déclaré par le détenteur »",
      checkupEvent.source_type === "declare_detenteur" && checkupEvent.author_label === "",
      checkupEvent.source_type
    );

    const { error: eventUpdateError } = await clients.member.client
      .from("nid_events")
      .update({ title: "Falsifié" })
      .eq("id", checkupEvent.id);
    const { data: eventAfter } = await admin
      .from("nid_events")
      .select("title")
      .eq("id", checkupEvent.id)
      .single();
    check(
      "Un utilisateur ne peut pas réécrire un événement de l'historique",
      eventAfter.title === checkupEvent.title,
      eventUpdateError?.message?.slice(0, 60) ?? "aucune ligne modifiée"
    );

    // ---- 14. Déclaration d'un problème (bilan rempli dans l'application) ----
    const { data: problemAnswer } = await admin.rpc("nid_answer_checkup_owner", {
      p_user_id: users.owner.id,
      p_asset_id: personalPhone.id,
      p_payload: {
        answer: "probleme",
        details: { ecran: "defaut" },
        comment: "Écran fissuré (test)",
      },
    });
    const { data: personalAfter } = await admin
      .from("nid_assets")
      .select("health_state")
      .eq("id", personalPhone.id)
      .single();
    check(
      "Un problème déclaré met l'état du téléphone à jour",
      problemAnswer?.state === "enregistre" && personalAfter.health_state === "probleme_declare",
      personalAfter.health_state
    );

    // ---- 16. Un salarié ne voit que son bilan ----
    const { data: memberRequests } = await clients.member.client
      .from("nid_check_requests")
      .select("id, asset_id");
    check(
      "Un salarié ne voit pas les bilans des autres téléphones",
      (memberRequests ?? []).every((row) => row.asset_id === companyPhone.id)
    );

    /* ================================================================ */
    /*  4. RÉPARATIONS                                                  */
    /* ================================================================ */

    const repairToken = newToken();
    const { data: repairCreate } = await admin.rpc("nid_create_repair_order", {
      p_actor_id: users.owner.id,
      p_asset_id: companyPhone.id,
      p_token_hash: sha256(repairToken),
      p_payload: {
        reported_problem: "Écran cassé (test)",
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      },
    });
    repairOrderId = repairCreate?.id;
    check("Demande de réparation créée", repairCreate?.state === "creee", repairCreate?.state);

    // ---- 17. Un atelier sans espace ni identité professionnelle est refusé ----
    const { data: claimWithout } = await admin.rpc("nid_claim_repair_order", {
      p_token_hash: sha256(repairToken),
      p_user_id: users.repairer.id,
    });
    check(
      "Un réparateur sans atelier ni identité professionnelle ne peut pas prendre l'intervention",
      claimWithout?.state === "atelier_requis",
      claimWithout?.state
    );

    // ---- 18. Accès temporaire du réparateur ----
    const { data: atelier } = await admin.rpc("nid_create_workspace", {
      p_user_id: users.repairer.id,
      p_kind: "atelier",
      p_name: `Atelier Test ${stamp}`,
    });
    const { data: claimResult } = await admin.rpc("nid_claim_repair_order", {
      p_token_hash: sha256(repairToken),
      p_user_id: users.repairer.id,
    });
    check(
      "L'atelier ouvre l'intervention via son lien temporaire",
      claimResult?.state === "ouvert" && Boolean(atelier?.id),
      claimResult?.state
    );

    // ---- 20. Soumission puis validation ----
    const { data: submitResult } = await admin.rpc("nid_submit_repair_order", {
      p_user_id: users.repairer.id,
      p_order_id: repairOrderId,
      p_payload: {
        visual_state: "Rayures",
        diagnosis: "Écran HS",
        operation: "Remplacement écran",
        parts: "Écran",
        parts_type: "compatible",
        amount_cents: "12900",
        warranty_months: "6",
        intervened_on: today(),
        comment: "",
      },
    });
    check("Intervention soumise par l'atelier", submitResult?.state === "soumis", submitResult?.state);

    const { data: outsiderSubmit } = await admin.rpc("nid_submit_repair_order", {
      p_user_id: users.outsider.id,
      p_order_id: repairOrderId,
      p_payload: { diagnosis: "x", operation: "y" },
    });
    check(
      "Un tiers ne peut pas modifier l'intervention",
      outsiderSubmit?.state === "non_autorise",
      outsiderSubmit?.state
    );

    const { data: validateResult } = await admin.rpc("nid_validate_repair_order", {
      p_user_id: users.owner.id,
      p_order_id: repairOrderId,
      p_decision: "valide",
      p_reason: "",
    });
    check(
      "Réparation validée par le client, SANS attestation (identité professionnelle absente)",
      validateResult?.state === "valide" && validateResult?.attested === false,
      `${validateResult?.state} / attested=${validateResult?.attested}`
    );

    const { data: repairEvent } = await admin
      .from("nid_events")
      .select("source_type, trust_level, title")
      .eq("id", validateResult.event_id)
      .single();
    check(
      "L'événement porte « Intervention déclarée par l'atelier », jamais une attestation non méritée",
      repairEvent.trust_level === 0 && repairEvent.source_type === "declare_proprietaire",
      `${repairEvent.title} / ${repairEvent.source_type}`
    );

    // ---- 19. Expiration de l'accès ----
    await admin
      .from("nid_repair_orders")
      .update({ status: "en_cours", expires_at: new Date(Date.now() - 3600_000).toISOString() })
      .eq("id", repairOrderId);
    const { data: expiredSubmit } = await admin.rpc("nid_submit_repair_order", {
      p_user_id: users.repairer.id,
      p_order_id: repairOrderId,
      p_payload: { diagnosis: "x", operation: "y" },
    });
    check(
      "Un accès réparateur expiré est refusé",
      expiredSubmit?.state === "expire",
      expiredSubmit?.state
    );

    /* ================================================================ */
    /*  5. RAPPORT PARTAGÉ                                              */
    /* ================================================================ */

    const shareToken = newToken();
    await admin.from("nid_share_links").insert({
      asset_id: companyPhone.id,
      created_by: users.owner.id,
      token_hash: sha256(shareToken),
      label: "Rapport de test",
      sections: ["caracteristiques", "historique"],
      document_ids: [],
      allow_download: false,
      show_serial_last4: false,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    });

    const { data: report } = await admin.rpc("nid_share_report", {
      p_token_hash: sha256(shareToken),
    });
    const serialised = JSON.stringify(report);
    check(
      "Rapport partagé valide, avec sa date d'expiration",
      report?.state === "valide" && Boolean(report.expires_at)
    );
    check(
      "Le rapport ne contient ni identifiant complet, ni nom de salarié, ni commentaire interne",
      !serialised.includes(`ENT${stamp}`) &&
        !serialised.includes("Emma Test") &&
        !serialised.includes("Commentaire interne de test") &&
        !serialised.includes(emails.member)
    );
    check(
      "Le rapport indique la provenance de chaque événement",
      Array.isArray(report.events) &&
        report.events.length > 0 &&
        report.events.every((event) => typeof event.source_type === "string")
    );

    // Expiré puis révoqué.
    const expiredShare = newToken();
    await admin.from("nid_share_links").insert({
      asset_id: companyPhone.id,
      created_by: users.owner.id,
      token_hash: sha256(expiredShare),
      sections: ["caracteristiques"],
      expires_at: new Date(Date.now() - 86400_000).toISOString(),
    });
    const { data: expiredReport } = await admin.rpc("nid_share_report", {
      p_token_hash: sha256(expiredShare),
    });

    const revokedShare = newToken();
    await admin.from("nid_share_links").insert({
      asset_id: companyPhone.id,
      created_by: users.owner.id,
      token_hash: sha256(revokedShare),
      sections: ["caracteristiques"],
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      revoked_at: new Date().toISOString(),
    });
    const { data: revokedReport } = await admin.rpc("nid_share_report", {
      p_token_hash: sha256(revokedShare),
    });
    check(
      "Un rapport expiré et un rapport révoqué sont refusés, avec un état explicite",
      expiredReport?.state === "expire" && revokedReport?.state === "revoque",
      `${expiredReport?.state} / ${revokedReport?.state}`
    );

    /* ================================================================ */
    /*  6. QUOTAS, ABONNEMENTS ET ADMINISTRATION                        */
    /* ================================================================ */

    // ---- 28. Quota serveur (offre personnelle : 3 téléphones) ----
    await createPhone({
      ownerId: users.outsider.id,
      workspaceId: (
        await admin
          .from("nid_workspaces")
          .select("id")
          .eq("owner_user_id", users.outsider.id)
          .eq("kind", "personnel")
          .single()
      ).data.id,
      brand: "Quota",
      model: "Q1",
      serial: `Q1${stamp}`,
    });
    const outsiderWorkspace = (
      await admin
        .from("nid_workspaces")
        .select("id")
        .eq("owner_user_id", users.outsider.id)
        .eq("kind", "personnel")
        .single()
    ).data.id;
    await createPhone({
      ownerId: users.outsider.id,
      workspaceId: outsiderWorkspace,
      brand: "Quota",
      model: "Q2",
      serial: `Q2${stamp}`,
    });
    await createPhone({
      ownerId: users.outsider.id,
      workspaceId: outsiderWorkspace,
      brand: "Quota",
      model: "Q3",
      serial: `Q3${stamp}`,
    });
    let quotaError = null;
    try {
      await createPhone({
        ownerId: users.outsider.id,
        workspaceId: outsiderWorkspace,
        brand: "Quota",
        model: "Q4",
        serial: `Q4${stamp}`,
      });
    } catch (error) {
      quotaError = error;
    }
    check(
      "Le quota de l'offre gratuite est appliqué CÔTÉ SERVEUR (4e téléphone refusé)",
      Boolean(quotaError) && quotaError.message.includes("QUOTA_REACHED"),
      quotaError?.message?.slice(0, 60)
    );

    // ---- 29. Aucun plan payant sans paiement ----
    const { data: newCompanyPlan } = await admin
      .from("nid_workspaces")
      .select("plan, plan_status, stripe_subscription_id")
      .eq("id", companyId)
      .single();
    const { error: planTamper } = await clients.owner.client
      .from("nid_workspaces")
      .update({ plan: "entreprise_equipe" })
      .eq("id", companyId);
    const { data: planAfter } = await admin
      .from("nid_workspaces")
      .select("plan")
      .eq("id", companyId)
      .single();
    check(
      "Un utilisateur ne peut pas s'attribuer une offre payante depuis le navigateur",
      planAfter.plan === newCompanyPlan.plan && newCompanyPlan.stripe_subscription_id === null,
      planTamper?.message?.slice(0, 60) ?? "colonne non modifiable"
    );

    // ---- 27. Séparation des administrations ----
    const { data: nidAdmins } = await admin
      .from("nid_admins")
      .select("user_id")
      .eq("user_id", users.owner.id);
    check(
      "Être propriétaire d'une entreprise ne donne AUCUN droit sur /id/admin",
      (nidAdmins ?? []).length === 0
    );

    const { data: immoAdmins, error: immoAdminError } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", users.owner.id);
    check(
      "Aucun privilège ne traverse vers l'administration Nireo Immo",
      immoAdminError ? true : (immoAdmins ?? []).length === 0,
      immoAdminError?.message?.slice(0, 40)
    );

    // ---- 30. Doublon (chemin utilisé par l'import CSV) ----
    let duplicateError = null;
    try {
      await createPhone({
        ownerId: users.owner.id,
        workspaceId: companyId,
        brand: "TestPro",
        model: "E1-bis",
        serial: `ENT${stamp}`,
      });
    } catch (error) {
      duplicateError = error;
    }
    check(
      "Un doublon d'identifiant est refusé sans révéler son détenteur",
      Boolean(duplicateError) && duplicateError.message.includes("SERIAL_ALREADY_REGISTERED"),
      duplicateError?.message?.slice(0, 60)
    );

    // ---- Membre non autorisé : écriture de parc refusée ----
    const { error: memberWrite } = await clients.member.client
      .from("nid_assets")
      .update({ fleet_status: "vendu" })
      .eq("id", companyPhone.id);
    const { data: fleetAfter } = await admin
      .from("nid_assets")
      .select("fleet_status")
      .eq("id", companyPhone.id)
      .single();
    check(
      "Un salarié ne peut pas modifier le statut d'un téléphone du parc",
      fleetAfter.fleet_status !== "vendu",
      memberWrite?.message?.slice(0, 60) ?? "aucune ligne modifiée"
    );
  } catch (error) {
    console.error("ERREUR TEST :", error.message);
    process.exitCode = 1;
  } finally {
    // ---- Nettoyage complet ----
    try {
      for (const user of Object.values(users)) {
        if (!user) continue;
        await admin.from("nid_admins").delete().eq("user_id", user.id);
        await admin.auth.admin.deleteUser(user.id);
      }
      // Les espaces, téléphones, bilans et réparations disparaissent par
      // cascade (owner_user_id / current_owner_id → auth.users).
      console.log("\nNettoyage : comptes et données de test supprimés.");
    } catch (error) {
      console.error("Nettoyage partiel :", error.message);
    }

    const failed = results.filter((r) => !r.ok).length;
    console.log(`${results.length - failed}/${results.length} tests PASS`);
    if (failed) process.exitCode = 1;
  }
}
