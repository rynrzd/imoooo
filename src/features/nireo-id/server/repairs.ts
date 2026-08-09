import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/supabase/config";
import { REPAIR_LINK_DAYS, type PartsType, type RepairStatus } from "../constants";
import { createToken, hashToken } from "../identifiers";
import type { RepairOrderRow } from "../types";
import { recordNidAudit } from "./audit";
import { dbErrorMessage, isNireoIdConfigured, isSchemaMissing, nidService } from "./client";
import { notifyRepairInvitation, notifyRepairSubmitted, notifyRepairValidated } from "./emails";

/**
 * Parcours réparation.
 *
 * L'atelier n'obtient JAMAIS un accès général : il reçoit un lien limité à
 * UNE intervention, expirant et révocable. L'événement n'est marqué
 * « Attesté par un réparateur » que si l'identité professionnelle
 * rattachée est approuvée par Nireo — la décision est prise en base.
 */

export interface RepairWithDevice extends RepairOrderRow {
  device: string;
  public_id: string;
}

function deviceLabel(asset: { brand: string; model: string } | null): string {
  return asset ? `${asset.brand} ${asset.model}` : "Téléphone";
}

/* ------------------------------------------------------------------ */
/*  Lectures                                                           */
/* ------------------------------------------------------------------ */

export async function listRepairsForAsset(assetId: string): Promise<RepairOrderRow[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_repair_orders")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/repairs asset", error);
    return [];
  }
  return (data ?? []) as RepairOrderRow[];
}

export async function listRepairsForWorkspace(workspaceId: string): Promise<RepairWithDevice[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_repair_orders")
    .select("*, asset:nid_assets (brand, model, public_id)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  const rows = (data ?? []) as unknown as (RepairOrderRow & {
    asset: { brand: string; model: string; public_id: string } | null;
  })[];
  return rows.map((row) => ({
    ...row,
    device: deviceLabel(row.asset),
    public_id: row.asset?.public_id ?? "",
  }));
}

/** Tableau d'un atelier : à diagnostiquer, en cours, à valider, terminées. */
export async function listRepairsForRepairer(
  userId: string,
  repairerWorkspaceId: string | null,
  professionalId: string | null
): Promise<RepairWithDevice[]> {
  if (!isNireoIdConfigured) return [];
  if (!repairerWorkspaceId && !professionalId) return [];

  const filters: string[] = [];
  if (repairerWorkspaceId) filters.push(`repairer_workspace_id.eq.${repairerWorkspaceId}`);
  if (professionalId) filters.push(`professional_id.eq.${professionalId}`);

  const { data, error } = await nidService()
    .from("nid_repair_orders")
    .select("*, asset:nid_assets (brand, model, public_id)")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/repairs repairer", error);
    return [];
  }
  const rows = (data ?? []) as unknown as (RepairOrderRow & {
    asset: { brand: string; model: string; public_id: string } | null;
  })[];
  return rows.map((row) => ({
    ...row,
    device: deviceLabel(row.asset),
    public_id: row.asset?.public_id ?? "",
  }));
}

/** Interventions soumises par un atelier et en attente de validation. */
export async function listRepairsAwaitingValidation(
  userId: string
): Promise<RepairWithDevice[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_repair_orders")
    .select("*, asset:nid_assets (brand, model, public_id)")
    .eq("status", "en_attente_validation")
    .eq("requested_by", userId)
    .order("submitted_at", { ascending: true })
    .limit(20);
  if (error) return [];
  const rows = (data ?? []) as unknown as (RepairOrderRow & {
    asset: { brand: string; model: string; public_id: string } | null;
  })[];
  return rows.map((row) => ({
    ...row,
    device: deviceLabel(row.asset),
    public_id: row.asset?.public_id ?? "",
  }));
}

export async function getRepairOrder(orderId: string): Promise<RepairWithDevice | null> {
  if (!isNireoIdConfigured) return null;
  const { data } = await nidService()
    .from("nid_repair_orders")
    .select("*, asset:nid_assets (brand, model, public_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as RepairOrderRow & {
    asset: { brand: string; model: string; public_id: string } | null;
  };
  return { ...row, device: deviceLabel(row.asset), public_id: row.asset?.public_id ?? "" };
}

export function groupRepairs(orders: RepairWithDevice[]): Record<RepairStatus, RepairWithDevice[]> {
  const groups: Record<RepairStatus, RepairWithDevice[]> = {
    a_diagnostiquer: [],
    en_cours: [],
    en_attente_validation: [],
    termine: [],
    annule: [],
  };
  for (const order of orders) groups[order.status].push(order);
  return groups;
}

/* ------------------------------------------------------------------ */
/*  Création (propriétaire ou responsable de parc)                     */
/* ------------------------------------------------------------------ */

export interface RepairCreation {
  order_id: string;
  url: string;
  expires_at: string;
}

export async function createRepairOrder(
  userId: string,
  assetId: string,
  reportedProblem: string
): Promise<RepairCreation> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + REPAIR_LINK_DAYS * 86400 * 1000).toISOString();

  const { data, error } = await nidService().rpc("nid_create_repair_order", {
    p_actor_id: userId,
    p_asset_id: assetId,
    p_token_hash: hashToken(token),
    p_payload: { reported_problem: reportedProblem, expires_at: expiresAt },
  });
  if (error) throw new Error(dbErrorMessage(error, "La demande de réparation a échoué."));

  const result = data as { state: string; id?: string };
  if (result.state === "non_autorise") {
    throw new Error("Vous ne pouvez pas créer de réparation pour ce téléphone.");
  }

  return {
    order_id: result.id as string,
    url: `${SITE_URL}/id/reparation/${token}`,
    expires_at: expiresAt,
  };
}

/** Envoi facultatif du lien à l'atelier par e-mail (jamais simulé). */
export async function sendRepairLink(
  orderId: string,
  url: string,
  email: string
): Promise<boolean> {
  const order = await getRepairOrder(orderId);
  if (!order) return false;
  return notifyRepairInvitation({ to: email, deviceLabel: order.device, url });
}

/* ------------------------------------------------------------------ */
/*  Prise en charge par l'atelier                                      */
/* ------------------------------------------------------------------ */

export async function claimRepairOrder(
  token: string,
  userId: string
): Promise<{ state: string; id?: string; asset_id?: string }> {
  const { data, error } = await nidService().rpc("nid_claim_repair_order", {
    p_token_hash: hashToken(token),
    p_user_id: userId,
  });
  if (error) throw new Error(dbErrorMessage(error, "Ce lien n'a pas pu être ouvert."));
  return data as { state: string; id?: string; asset_id?: string };
}

export function claimErrorMessage(state: string): string {
  switch (state) {
    case "introuvable":
      return "Ce lien d'intervention n'existe pas.";
    case "expire":
      return "Ce lien d'intervention a expiré. Demandez-en un nouveau au client.";
    case "cloture":
      return "Cette intervention est déjà clôturée.";
    case "auto_intervention":
      return "Vous êtes à l'origine de cette demande : ouvrez-la depuis votre espace.";
    case "atelier_requis":
      return (
        "Créez d'abord votre espace atelier (ou votre compte professionnel) " +
        "pour enregistrer une intervention."
      );
    default:
      return "Cette intervention n'est pas accessible.";
  }
}

/* ------------------------------------------------------------------ */
/*  Soumission et validation                                           */
/* ------------------------------------------------------------------ */

export interface SubmitRepairInput {
  order_id: string;
  visual_state: string;
  diagnosis: string;
  operation: string;
  parts: string;
  parts_type: PartsType;
  amount_euros: number | null | undefined;
  warranty_months: number | null | undefined;
  intervened_on: string;
  comment: string;
}

export async function submitRepairOrder(
  userId: string,
  input: SubmitRepairInput
): Promise<void> {
  const service = nidService();
  const { data, error } = await service.rpc("nid_submit_repair_order", {
    p_user_id: userId,
    p_order_id: input.order_id,
    p_payload: {
      visual_state: input.visual_state,
      diagnosis: input.diagnosis,
      operation: input.operation,
      parts: input.parts,
      parts_type: input.parts_type,
      amount_cents:
        input.amount_euros === null || input.amount_euros === undefined
          ? ""
          : String(Math.round(input.amount_euros * 100)),
      warranty_months:
        input.warranty_months === null || input.warranty_months === undefined
          ? ""
          : String(input.warranty_months),
      intervened_on: input.intervened_on,
      comment: input.comment,
    },
  });
  if (error) throw new Error(dbErrorMessage(error, "L'enregistrement de l'intervention a échoué."));

  const result = data as { state: string };
  if (result.state === "non_autorise") {
    throw new Error("Vous n'avez pas accès à cette intervention.");
  }
  if (result.state === "expire") {
    throw new Error("Le lien de cette intervention a expiré.");
  }
  if (result.state === "cloture") {
    throw new Error("Cette intervention est déjà clôturée.");
  }
  if (result.state === "introuvable") throw new Error("Intervention introuvable.");

  // Le client est prévenu qu'une validation est attendue.
  try {
    const order = await getRepairOrder(input.order_id);
    if (order?.requested_by) {
      const { data: user } = await service.auth.admin.getUserById(order.requested_by);
      const email = user?.user?.email;
      if (email) {
        await notifyRepairSubmitted({
          to: email,
          deviceLabel: order.device,
          repairerLabel: order.repairer_label || "L'atelier",
          url: `${SITE_URL}/id/app/objets/${order.asset_id}`,
        });
      }
    }
  } catch (error) {
    logger.error("nireo-id/repairs notify-submitted", error);
  }
}

export async function validateRepairOrder(
  userId: string,
  orderId: string,
  decision: "valide" | "refuse",
  reason: string
): Promise<{ attested: boolean }> {
  const service = nidService();
  const { data, error } = await service.rpc("nid_validate_repair_order", {
    p_user_id: userId,
    p_order_id: orderId,
    p_decision: decision === "valide" ? "valide" : "refuse",
    p_reason: reason,
  });
  if (error) throw new Error(dbErrorMessage(error, "La décision n'a pas pu être enregistrée."));

  const result = data as { state: string; attested?: boolean };
  if (result.state === "non_autorise") {
    throw new Error("Vous ne pouvez pas valider cette intervention.");
  }
  if (result.state === "etat_invalide") {
    throw new Error("Cette intervention n'attend pas de validation.");
  }
  if (result.state === "introuvable") throw new Error("Intervention introuvable.");

  await recordNidAudit({
    actorUserId: userId,
    action: decision === "valide" ? "repair.validated" : "repair.refused",
    targetType: "repair_order",
    targetId: orderId,
  });

  if (decision === "valide") {
    try {
      const order = await getRepairOrder(orderId);
      if (order?.professional_id) {
        const { data: pro } = await service
          .from("nid_professional_profiles")
          .select("contact_email")
          .eq("id", order.professional_id)
          .maybeSingle();
        const email = (pro as { contact_email: string } | null)?.contact_email;
        if (email) {
          await notifyRepairValidated({
            to: email,
            deviceLabel: order.device,
            attested: Boolean(result.attested),
          });
        }
      }
    } catch (error) {
      logger.error("nireo-id/repairs notify-validated", error);
    }
  }

  return { attested: Boolean(result.attested) };
}

/** Annulation par le demandeur (le lien de l'atelier devient inutile). */
export async function cancelRepairOrder(userId: string, orderId: string): Promise<void> {
  const service = nidService();
  const { data: order } = await service
    .from("nid_repair_orders")
    .select("id, requested_by, asset_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const row = order as { requested_by: string | null; asset_id: string; status: string } | null;
  if (!row) throw new Error("Intervention introuvable.");
  if (row.requested_by !== userId) {
    throw new Error("Seul le demandeur peut annuler cette intervention.");
  }
  if (row.status === "termine") {
    throw new Error("Cette intervention est terminée : elle ne peut plus être annulée.");
  }

  const { error } = await service
    .from("nid_repair_orders")
    .update({ status: "annule", token_hash: null, expires_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(dbErrorMessage(error, "L'annulation a échoué."));

  await service
    .from("nid_assets")
    .update({ health_state: "a_surveiller" })
    .eq("id", row.asset_id)
    .eq("health_state", "en_reparation");

  await recordNidAudit({
    actorUserId: userId,
    action: "repair.cancelled",
    targetType: "repair_order",
    targetId: orderId,
    assetId: row.asset_id,
  });
}
