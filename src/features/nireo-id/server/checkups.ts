import { logger } from "@/lib/logger";
import { isEmailProviderConfigured } from "@/lib/email/provider";
import { SITE_URL } from "@/lib/supabase/config";
import {
  CHECK_REQUEST_DAYS,
  type CheckAnswer,
  type CheckScope,
} from "../constants";
import { createToken, hashToken } from "../identifiers";
import type {
  CheckCampaignRow,
  CheckRequestResolution,
  CheckRequestRow,
  CheckScheduleRow,
  CheckupRow,
} from "../types";
import { recordNidAudit } from "./audit";
import { dbErrorMessage, isNireoIdConfigured, isSchemaMissing, nidService } from "./client";
import { notifyCheckRequest, notifyProblemDeclared } from "./emails";

/**
 * Bilans — la fonction différenciante de Nireo ID.
 *
 * Garanties :
 *  • le jeton d'un bilan n'est stocké que HACHÉ, limité à un téléphone,
 *    expirant et révocable ;
 *  • la création d'une demande est idempotente (une seule demande par
 *    téléphone et par échéance) : relancer le planificateur n'envoie
 *    jamais deux e-mails ;
 *  • si aucun fournisseur e-mail n'est configuré, RIEN n'est marqué
 *    « envoyé » : la demande passe en « lien à transmettre » et
 *    l'interface affiche le lien à copier.
 */

export interface CheckRequestOutcome {
  state: "creee" | "existante";
  request_id: string;
  url: string | null;
  email_sent: boolean;
  already_answered: boolean;
}

interface CreateRequestOptions {
  assetId: string;
  workspaceId: string | null;
  recipientEmail: string;
  recipientName?: string;
  recipientUserId?: string | null;
  scope?: CheckScope;
  dueOn?: string;
  campaignId?: string | null;
  createdBy?: string | null;
  deviceLabel: string;
  companyName?: string | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Crée une demande de bilan et tente l'envoi de l'e-mail.
 * Le lien brut n'est renvoyé que si l'appelant est autorisé à le voir
 * (propriétaire ou responsable) — il ne transite jamais par la base.
 */
export async function createCheckRequest(
  options: CreateRequestOptions
): Promise<CheckRequestOutcome> {
  const service = nidService();
  const token = createToken();

  const { data, error } = await service.rpc("nid_create_check_request", {
    p_asset_id: options.assetId,
    p_token_hash: hashToken(token),
    p_payload: {
      workspace_id: options.workspaceId ?? "",
      campaign_id: options.campaignId ?? "",
      recipient_user_id: options.recipientUserId ?? "",
      recipient_name: options.recipientName ?? "",
      recipient_email: options.recipientEmail,
      scope: options.scope ?? "mini",
      due_on: options.dueOn ?? todayISO(),
      expires_at: new Date(Date.now() + CHECK_REQUEST_DAYS * 86400 * 1000).toISOString(),
      created_by: options.createdBy ?? "",
    },
  });

  if (error) throw new Error(dbErrorMessage(error, "La demande de bilan a échoué."));

  const result = data as { state: "creee" | "existante"; id: string; answered?: boolean };

  if (result.state === "existante") {
    // Demande déjà vivante pour cette échéance : aucun second envoi.
    return {
      state: "existante",
      request_id: result.id,
      url: null,
      email_sent: false,
      already_answered: Boolean(result.answered),
    };
  }

  const url = `${SITE_URL}/id/bilan/${token}`;
  const emailSent = await notifyCheckRequest({
    to: options.recipientEmail,
    deviceLabel: options.deviceLabel,
    url,
    companyName: options.companyName ?? null,
    recipientName: options.recipientName,
  });

  await service
    .from("nid_check_requests")
    .update({
      sent_at: emailSent ? new Date().toISOString() : null,
      email_status: emailSent ? "envoye" : isEmailProviderConfigured ? "echec" : "manuel",
      email_error: emailSent
        ? ""
        : isEmailProviderConfigured
          ? "L'envoi a été refusé par le fournisseur."
          : "Aucun fournisseur e-mail configuré : lien à transmettre manuellement.",
    })
    .eq("id", result.id);

  await recordNidAudit({
    actorUserId: options.createdBy ?? null,
    actorRole: options.createdBy ? "utilisateur" : "systeme",
    action: "checkup.requested",
    targetType: "check_request",
    targetId: result.id,
    assetId: options.assetId,
    metadata: { email_sent: emailSent },
  });

  return {
    state: "creee",
    request_id: result.id,
    url,
    email_sent: emailSent,
    already_answered: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Résolution d'un lien de bilan                                      */
/* ------------------------------------------------------------------ */

/** Lit une demande à partir du jeton brut. Aucune donnée sensible exposée. */
export async function resolveCheckRequest(token: string): Promise<CheckRequestResolution> {
  if (!isNireoIdConfigured) return { state: "introuvable" };
  const service = nidService();

  const { data, error } = await service
    .from("nid_check_requests")
    .select(
      "id, asset_id, workspace_id, scope, due_on, expires_at, recipient_name, answered_at, revoked_at, checkup_id"
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return { state: "introuvable" };
  const request = data as Pick<
    CheckRequestRow,
    | "id"
    | "asset_id"
    | "workspace_id"
    | "scope"
    | "due_on"
    | "expires_at"
    | "recipient_name"
    | "answered_at"
    | "revoked_at"
    | "checkup_id"
  >;

  if (request.revoked_at) return { state: "revoque" };

  if (request.answered_at) {
    let answer: CheckAnswer | null = null;
    if (request.checkup_id) {
      const { data: checkup } = await service
        .from("nid_checkups")
        .select("answer")
        .eq("id", request.checkup_id)
        .maybeSingle();
      answer = (checkup as { answer: CheckAnswer } | null)?.answer ?? null;
    }
    return { state: "deja_repondu", answer, answeredAt: request.answered_at };
  }

  if (new Date(request.expires_at).getTime() <= Date.now()) return { state: "expire" };

  const { data: asset } = await service
    .from("nid_assets")
    .select("brand, model, color, public_id")
    .eq("id", request.asset_id)
    .maybeSingle();
  if (!asset) return { state: "introuvable" };

  // Première ouverture du lien (trace utile en cas de litige).
  await service
    .from("nid_check_requests")
    .update({ first_used_at: new Date().toISOString() })
    .eq("id", request.id)
    .is("first_used_at", null);

  return {
    state: "valide",
    request: {
      id: request.id,
      scope: request.scope,
      due_on: request.due_on,
      expires_at: request.expires_at,
      recipient_name: request.recipient_name,
      is_company: Boolean(request.workspace_id),
    },
    device: asset as { brand: string; model: string; color: string; public_id: string },
  };
}

/* ------------------------------------------------------------------ */
/*  Réponse                                                            */
/* ------------------------------------------------------------------ */

export interface AnswerOutcome {
  state: string;
  answer?: CheckAnswer;
  asset_id?: string;
}

/**
 * Enregistre la réponse. La fonction SQL est idempotente : un double clic
 * ou un double onglet n'ajoute jamais deux entrées à l'historique.
 */
export async function answerCheckup(
  token: string,
  userId: string | null,
  payload: { answer: CheckAnswer; details: Record<string, string>; comment: string }
): Promise<AnswerOutcome> {
  const service = nidService();
  const { data, error } = await service.rpc("nid_answer_checkup", {
    p_token_hash: hashToken(token),
    p_user_id: userId,
    p_payload: {
      answer: payload.answer,
      details: payload.details,
      comment: payload.comment,
    },
  });
  if (error) throw new Error(dbErrorMessage(error, "L'enregistrement du bilan a échoué."));

  const result = data as AnswerOutcome;

  // Un problème déclaré prévient le propriétaire (jamais de surveillance :
  // l'e-mail ne contient que l'état matériel signalé).
  if (result.state === "enregistre" && result.answer === "probleme" && result.asset_id) {
    await notifyOwnerOfProblem(result.asset_id, payload.comment);
  }

  return result;
}

/**
 * Bilan rempli directement dans l'application par le propriétaire (ou le
 * détenteur connecté). Aucun jeton n'est nécessaire : l'autorisation vient
 * de la propriété, revérifiée en base.
 */
export async function answerOwnCheckup(
  userId: string,
  assetId: string,
  payload: { answer: CheckAnswer; details: Record<string, string>; comment: string }
): Promise<AnswerOutcome> {
  const { data, error } = await nidService().rpc("nid_answer_checkup_owner", {
    p_user_id: userId,
    p_asset_id: assetId,
    p_payload: {
      answer: payload.answer,
      details: payload.details,
      comment: payload.comment,
    },
  });
  if (error) throw new Error(dbErrorMessage(error, "L'enregistrement du bilan a échoué."));

  const result = data as AnswerOutcome;
  if (result.state === "enregistre" && payload.answer === "probleme") {
    await notifyOwnerOfProblem(assetId, payload.comment);
  }
  return result;
}

/** Historique des bilans d'un téléphone. */
export async function listCheckups(assetId: string): Promise<CheckupRow[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_checkups")
    .select("*")
    .eq("asset_id", assetId)
    .order("answered_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as CheckupRow[];
}

async function notifyOwnerOfProblem(assetId: string, comment: string): Promise<void> {
  try {
    const service = nidService();
    const { data: asset } = await service
      .from("nid_assets")
      .select("id, brand, model, current_owner_id")
      .eq("id", assetId)
      .maybeSingle();
    const row = asset as {
      id: string;
      brand: string;
      model: string;
      current_owner_id: string | null;
    } | null;
    if (!row?.current_owner_id) return;

    const { data: owner } = await service.auth.admin.getUserById(row.current_owner_id);
    const email = owner?.user?.email;
    if (!email) return;

    await notifyProblemDeclared({
      to: email,
      deviceLabel: `${row.brand} ${row.model}`,
      holderLabel: "Le détenteur du téléphone",
      comment,
      url: `${SITE_URL}/id/app/objets/${row.id}`,
    });
  } catch (error) {
    logger.error("nireo-id/checkups notify-problem", error);
  }
}

/* ------------------------------------------------------------------ */
/*  Planification                                                      */
/* ------------------------------------------------------------------ */

export async function getSchedule(assetId: string): Promise<CheckScheduleRow | null> {
  if (!isNireoIdConfigured) return null;
  const { data, error } = await nidService()
    .from("nid_check_schedules")
    .select("*")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/checkups schedule", error);
    return null;
  }
  return (data as CheckScheduleRow | null) ?? null;
}

/** Fréquence modifiable, rappels désactivables. */
export async function updateSchedule(
  userId: string,
  assetId: string,
  frequencyMonths: number,
  enabled: boolean
): Promise<void> {
  const service = nidService();
  const { data: asset } = await service
    .from("nid_assets")
    .select("id, current_owner_id, workspace_id")
    .eq("id", assetId)
    .maybeSingle();
  const row = asset as { current_owner_id: string | null; workspace_id: string | null } | null;
  if (!row) throw new Error("Téléphone introuvable.");

  if (row.current_owner_id !== userId) {
    const { data: member } = await service
      .from("nid_workspace_members")
      .select("role")
      .eq("workspace_id", row.workspace_id ?? "")
      .eq("user_id", userId)
      .eq("status", "actif")
      .maybeSingle();
    const role = (member as { role: string } | null)?.role;
    if (!role || !["owner", "admin", "manager"].includes(role)) {
      throw new Error("Vous ne pouvez pas modifier la planification de ce téléphone.");
    }
  }

  const next = new Date();
  next.setDate(next.getDate() + frequencyMonths * 30);

  const { error } = await service
    .from("nid_check_schedules")
    .upsert(
      {
        asset_id: assetId,
        workspace_id: row.workspace_id,
        frequency_months: frequencyMonths,
        enabled,
        next_due_on: next.toISOString().slice(0, 10),
      },
      { onConflict: "asset_id" }
    );
  if (error) throw new Error(dbErrorMessage(error, "La planification n'a pas pu être enregistrée."));
}

/* ------------------------------------------------------------------ */
/*  Destinataire d'un bilan                                            */
/* ------------------------------------------------------------------ */

export interface CheckRecipient {
  email: string;
  name: string;
  userId: string | null;
}

/**
 * Qui doit répondre ? Le détenteur affecté s'il existe, sinon le
 * propriétaire du téléphone. `null` si aucune adresse n'est connue :
 * dans ce cas rien n'est envoyé et l'interface propose le lien manuel.
 */
export async function resolveRecipient(
  assetId: string,
  ownerId: string | null,
  workspaceId: string | null
): Promise<CheckRecipient | null> {
  const service = nidService();

  if (workspaceId) {
    const { data: assignment } = await service
      .from("nid_assignments")
      .select("holder_user_id, holder_name, holder_email")
      .eq("asset_id", assetId)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .maybeSingle();
    const row = assignment as {
      holder_user_id: string | null;
      holder_name: string;
      holder_email: string;
    } | null;
    if (row?.holder_email) {
      return { email: row.holder_email, name: row.holder_name, userId: row.holder_user_id };
    }
    if (row?.holder_user_id) {
      const { data: user } = await service.auth.admin.getUserById(row.holder_user_id);
      if (user?.user?.email) {
        return { email: user.user.email, name: row.holder_name, userId: row.holder_user_id };
      }
    }
  }

  if (!ownerId) return null;
  const { data: owner } = await service.auth.admin.getUserById(ownerId);
  const email = owner?.user?.email;
  if (!email) return null;
  return { email, name: "", userId: ownerId };
}

/* ------------------------------------------------------------------ */
/*  Lectures applicatives                                              */
/* ------------------------------------------------------------------ */

export interface PendingCheck {
  request_id: string;
  asset_id: string;
  brand: string;
  model: string;
  due_on: string;
  email_status: string;
  workspace_id: string | null;
}

/** Bilans en attente de réponse pour un utilisateur (accueil personnel). */
export async function listPendingChecks(userId: string): Promise<PendingCheck[]> {
  if (!isNireoIdConfigured) return [];
  const service = nidService();
  const { data, error } = await service
    .from("nid_check_requests")
    .select(
      "id, asset_id, due_on, email_status, workspace_id, asset:nid_assets (brand, model, current_owner_id)"
    )
    .is("answered_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .or(`recipient_user_id.eq.${userId},created_by.eq.${userId}`)
    .order("due_on", { ascending: true })
    .limit(20);

  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/checkups pending", error);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    asset_id: string;
    due_on: string;
    email_status: string;
    workspace_id: string | null;
    asset: { brand: string; model: string; current_owner_id: string | null } | null;
  }[];

  return rows
    .filter((row) => row.asset)
    .map((row) => ({
      request_id: row.id,
      asset_id: row.asset_id,
      brand: row.asset?.brand ?? "",
      model: row.asset?.model ?? "",
      due_on: row.due_on,
      email_status: row.email_status,
      workspace_id: row.workspace_id,
    }));
}

export interface WorkspaceCheckBoard {
  upcoming: (CheckRequestRow & { device: string })[];
  answered: (CheckupRow & { device: string })[];
  overdue: (CheckRequestRow & { device: string })[];
  problems: (CheckupRow & { device: string })[];
}

/** Tableau « Bilans » d'une entreprise. */
export async function getWorkspaceCheckBoard(workspaceId: string): Promise<WorkspaceCheckBoard> {
  const empty: WorkspaceCheckBoard = { upcoming: [], answered: [], overdue: [], problems: [] };
  if (!isNireoIdConfigured) return empty;
  const service = nidService();

  const [{ data: requests }, { data: checkups }] = await Promise.all([
    service
      .from("nid_check_requests")
      .select("*, asset:nid_assets (brand, model)")
      .eq("workspace_id", workspaceId)
      .is("answered_at", null)
      .is("revoked_at", null)
      .order("due_on", { ascending: true })
      .limit(200),
    service
      .from("nid_checkups")
      .select("*, asset:nid_assets (brand, model)")
      .eq("workspace_id", workspaceId)
      .order("answered_at", { ascending: false })
      .limit(100),
  ]);

  const label = (row: { asset?: { brand: string; model: string } | null }) =>
    row.asset ? `${row.asset.brand} ${row.asset.model}` : "Téléphone";

  const today = todayISO();
  const requestRows = (requests ?? []) as unknown as (CheckRequestRow & {
    asset: { brand: string; model: string } | null;
  })[];
  const checkupRows = (checkups ?? []) as unknown as (CheckupRow & {
    asset: { brand: string; model: string } | null;
  })[];

  return {
    upcoming: requestRows
      .filter((row) => row.due_on >= today)
      .map((row) => ({ ...row, device: label(row) })),
    overdue: requestRows
      .filter((row) => row.due_on < today)
      .map((row) => ({ ...row, device: label(row) })),
    answered: checkupRows.map((row) => ({ ...row, device: label(row) })),
    problems: checkupRows
      .filter((row) => row.answer === "probleme")
      .map((row) => ({ ...row, device: label(row) })),
  };
}

/* ------------------------------------------------------------------ */
/*  Campagne d'entreprise                                              */
/* ------------------------------------------------------------------ */

export interface CampaignOutcome {
  campaign_id: string;
  total: number;
  sent: number;
  manual: number;
  skipped: number;
  manual_links: { asset: string; url: string }[];
}

/**
 * Lance une campagne sur une sélection de téléphones de l'espace.
 * Un salarié ne reçoit QUE le bilan du téléphone qui lui est affecté.
 */
export async function startCampaign(
  userId: string,
  workspaceId: string,
  workspaceName: string,
  assetIds: string[],
  label: string,
  scope: CheckScope
): Promise<CampaignOutcome> {
  const service = nidService();

  const { data: campaign, error: campaignError } = await service
    .from("nid_check_campaigns")
    .insert({
      workspace_id: workspaceId,
      label: label || `Campagne du ${new Date().toLocaleDateString("fr-FR")}`,
      created_by: userId,
      total: assetIds.length,
    })
    .select("id")
    .single();
  if (campaignError || !campaign) {
    throw new Error(dbErrorMessage(campaignError, "La campagne n'a pas pu être créée."));
  }
  const campaignId = (campaign as { id: string }).id;

  // Seuls les téléphones réellement rattachés à cet espace sont concernés.
  const { data: assets } = await service
    .from("nid_assets")
    .select("id, brand, model, current_owner_id, workspace_id")
    .eq("workspace_id", workspaceId)
    .in("id", assetIds.slice(0, 500));

  const rows = (assets ?? []) as {
    id: string;
    brand: string;
    model: string;
    current_owner_id: string | null;
  }[];

  let sent = 0;
  let manual = 0;
  let skipped = 0;
  const manualLinks: { asset: string; url: string }[] = [];

  for (const asset of rows) {
    const recipient = await resolveRecipient(asset.id, asset.current_owner_id, workspaceId);
    if (!recipient) {
      skipped += 1;
      continue;
    }
    try {
      const outcome = await createCheckRequest({
        assetId: asset.id,
        workspaceId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientUserId: recipient.userId,
        scope,
        campaignId,
        createdBy: userId,
        deviceLabel: `${asset.brand} ${asset.model}`,
        companyName: workspaceName,
      });
      if (outcome.state === "existante") {
        skipped += 1;
      } else if (outcome.email_sent) {
        sent += 1;
      } else {
        manual += 1;
        if (outcome.url) manualLinks.push({ asset: `${asset.brand} ${asset.model}`, url: outcome.url });
      }
    } catch (error) {
      logger.error("nireo-id/checkups campaign", error);
      skipped += 1;
    }
  }

  await service
    .from("nid_check_campaigns")
    .update({ sent, manual, failed: skipped, status: "terminee", total: rows.length })
    .eq("id", campaignId);

  return { campaign_id: campaignId, total: rows.length, sent, manual, skipped, manual_links: manualLinks };
}

export async function listCampaigns(workspaceId: string): Promise<CheckCampaignRow[]> {
  if (!isNireoIdConfigured) return [];
  const { data } = await nidService()
    .from("nid_check_campaigns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as CheckCampaignRow[];
}

/* ------------------------------------------------------------------ */
/*  Planificateur quotidien                                            */
/* ------------------------------------------------------------------ */

export interface DueRunResult {
  due: number;
  created: number;
  sent: number;
  manual: number;
  skipped: number;
}

/**
 * Parcourt les bilans dus. Idempotent : une échéance déjà traitée n'est
 * jamais renvoyée (index unique `(asset_id, due_on)` en base).
 */
export async function runDueCheckups(limit = 200): Promise<DueRunResult> {
  const service = nidService();
  const today = todayISO();

  const { data, error } = await service
    .from("nid_check_schedules")
    .select("asset_id, workspace_id, next_due_on, frequency_months")
    .eq("enabled", true)
    .lte("next_due_on", today)
    .order("next_due_on", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const schedules = (data ?? []) as {
    asset_id: string;
    workspace_id: string | null;
    next_due_on: string;
    frequency_months: number;
  }[];

  const result: DueRunResult = {
    due: schedules.length,
    created: 0,
    sent: 0,
    manual: 0,
    skipped: 0,
  };

  for (const schedule of schedules) {
    const { data: asset } = await service
      .from("nid_assets")
      .select("id, brand, model, current_owner_id, workspace_id, status")
      .eq("id", schedule.asset_id)
      .maybeSingle();
    const row = asset as {
      id: string;
      brand: string;
      model: string;
      current_owner_id: string | null;
      workspace_id: string | null;
      status: string;
    } | null;
    if (!row || row.status === "archived") {
      result.skipped += 1;
      continue;
    }

    const workspaceId = row.workspace_id;
    let companyName: string | null = null;
    if (workspaceId) {
      const { data: workspace } = await service
        .from("nid_workspaces")
        .select("name, kind")
        .eq("id", workspaceId)
        .maybeSingle();
      const ws = workspace as { name: string; kind: string } | null;
      companyName = ws && ws.kind !== "personnel" ? ws.name : null;
    }

    const recipient = await resolveRecipient(row.id, row.current_owner_id, workspaceId);
    if (!recipient) {
      result.skipped += 1;
      continue;
    }

    try {
      const outcome = await createCheckRequest({
        assetId: row.id,
        workspaceId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientUserId: recipient.userId,
        scope: "mini",
        dueOn: schedule.next_due_on,
        deviceLabel: `${row.brand} ${row.model}`,
        companyName,
      });
      if (outcome.state === "creee") {
        result.created += 1;
        if (outcome.email_sent) result.sent += 1;
        else result.manual += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      logger.error("nireo-id/checkups due", error);
      result.skipped += 1;
      continue;
    }

    // Échéance suivante : la demande courante reste ouverte jusqu'à
    // réponse, mais le planificateur ne la reproposera pas demain.
    const next = new Date(`${schedule.next_due_on}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + Math.max(1, schedule.frequency_months) * 30);
    await service
      .from("nid_check_schedules")
      .update({ next_due_on: next.toISOString().slice(0, 10) })
      .eq("asset_id", row.id);
  }

  return result;
}
