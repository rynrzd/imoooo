import type { z } from "zod";
import { logger } from "@/lib/logger";
import type { adminDisputeDecisionSchema, adminProDecisionSchema } from "../schemas";
import type {
  AuditLogRow,
  DisputeRow,
  ProfessionalProfileRow,
} from "../types";
import { dbErrorMessage, isNireoIdConfigured, nidService } from "./client";
import { recordNidAudit } from "./audit";
import { notifyProfessionalDecision } from "./emails";
import type { NidAdminContext } from "./guards";

/**
 * Administration Nireo ID.
 *
 * Périmètre volontairement étroit : candidatures professionnelles,
 * signalements, révocation motivée d'une validation, journal d'audit.
 * Aucune fonction « se connecter en tant que l'utilisateur », aucun accès
 * global aux documents privés : l'administration ne lit que le contexte
 * minimal nécessaire à une décision, et chaque décision est journalisée.
 */

type ProDecisionInput = z.infer<typeof adminProDecisionSchema>;
type DisputeDecisionInput = z.infer<typeof adminDisputeDecisionSchema>;

export interface AdminOverview {
  pendingApplications: number;
  approvedProfessionals: number;
  openDisputes: number;
  assets: number;
  proEvents: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const empty: AdminOverview = {
    pendingApplications: 0,
    approvedProfessionals: 0,
    openDisputes: 0,
    assets: 0,
    proEvents: 0,
  };
  if (!isNireoIdConfigured) return empty;
  const service = nidService();
  const head = { count: "exact" as const, head: true };

  try {
    const [applications, approved, disputes, assets, proEvents] = await Promise.all([
      service.from("nid_professional_profiles").select("id", head).eq("status", "en_attente"),
      service.from("nid_professional_profiles").select("id", head).eq("status", "approuve"),
      service.from("nid_disputes").select("id", head).in("status", ["ouvert", "en_examen"]),
      service.from("nid_assets").select("id", head),
      service.from("nid_events").select("id", head).eq("trust_level", 2),
    ]);

    return {
      pendingApplications: applications.count ?? 0,
      approvedProfessionals: approved.count ?? 0,
      openDisputes: disputes.count ?? 0,
      assets: assets.count ?? 0,
      proEvents: proEvents.count ?? 0,
    };
  } catch (error) {
    // Schéma absent ou base injoignable : la page affiche des compteurs à
    // zéro et un message explicite plutôt qu'une erreur brute.
    logger.error("nireo-id/admin overview", error);
    return empty;
  }
}

/* ------------------------------------------------------------------ */
/*  Candidatures professionnelles                                      */
/* ------------------------------------------------------------------ */

export async function listProfessionalApplications(
  status?: string
): Promise<ProfessionalProfileRow[]> {
  if (!isNireoIdConfigured) return [];
  let query = nidService()
    .from("nid_professional_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logger.error("nireo-id/admin applications", error);
    return [];
  }
  return (data ?? []) as ProfessionalProfileRow[];
}

export async function decideProfessional(
  admin: NidAdminContext,
  input: ProDecisionInput
): Promise<{ email_sent: boolean }> {
  const service = nidService();
  const { data: profile } = await service
    .from("nid_professional_profiles")
    .select("id, contact_email, status")
    .eq("id", input.professional_id)
    .maybeSingle();
  if (!profile) throw new Error("Cette candidature est introuvable.");

  const now = new Date().toISOString();
  const { error } = await service
    .from("nid_professional_profiles")
    .update({
      status: input.decision,
      decision_reason: input.reason,
      decided_by: admin.admin.id,
      decided_at: now,
      suspended_at: input.decision === "suspendu" ? now : null,
    })
    .eq("id", input.professional_id);
  if (error) throw new Error(dbErrorMessage(error, "La décision n'a pas pu être enregistrée."));

  // Une suspension coupe immédiatement les accès en cours.
  if (input.decision !== "approuve") {
    await service
      .from("nid_professional_access")
      .update({ status: "revoque", revoked_at: now })
      .eq("professional_id", input.professional_id)
      .in("status", ["en_attente", "accorde"]);
  }

  const emailSent = await notifyProfessionalDecision({
    to: (profile as { contact_email: string }).contact_email,
    decision: input.decision,
    reason: input.reason,
  });

  await recordNidAudit({
    actorUserId: admin.user.id,
    actorRole: "administrateur",
    action: `admin.professional_${input.decision}`,
    targetType: "professional",
    targetId: input.professional_id,
    metadata: { reason: input.reason.slice(0, 200), email_sent: emailSent },
  });

  return { email_sent: emailSent };
}

/* ------------------------------------------------------------------ */
/*  Signalements                                                       */
/* ------------------------------------------------------------------ */

export interface DisputeWithContext extends DisputeRow {
  asset: { public_id: string; brand: string; model: string } | null;
  event: { title: string; trust_level: number; effective_date: string } | null;
}

export async function listDisputes(status?: string): Promise<DisputeWithContext[]> {
  if (!isNireoIdConfigured) return [];
  let query = nidService()
    .from("nid_disputes")
    .select(
      "*, asset:nid_assets (public_id, brand, model), event:nid_events (title, trust_level, effective_date)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logger.error("nireo-id/admin disputes", error);
    return [];
  }
  return (data ?? []) as DisputeWithContext[];
}

export async function decideDispute(
  admin: NidAdminContext,
  input: DisputeDecisionInput
): Promise<void> {
  const service = nidService();
  const { data: dispute } = await service
    .from("nid_disputes")
    .select("id, asset_id, event_id, status")
    .eq("id", input.dispute_id)
    .maybeSingle();
  if (!dispute) throw new Error("Ce signalement est introuvable.");
  const row = dispute as { id: string; asset_id: string; event_id: string | null };

  const { error } = await service
    .from("nid_disputes")
    .update({
      status: input.decision,
      resolution: input.resolution,
      handled_by: admin.admin.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", input.dispute_id);
  if (error) throw new Error(dbErrorMessage(error, "La décision n'a pas pu être enregistrée."));

  // Passage d'un événement à « Contesté » : l'information reste visible mais
  // n'est plus présentée comme fiable.
  if (input.mark_event_disputed && row.event_id) {
    await service.from("nid_events").update({ trust_level: 3 }).eq("id", row.event_id);
    await service.from("nid_assets").update({ status: "disputed" }).eq("id", row.asset_id);
  }

  await recordNidAudit({
    actorUserId: admin.user.id,
    actorRole: "administrateur",
    action: `admin.dispute_${input.decision}`,
    targetType: "dispute",
    targetId: input.dispute_id,
    assetId: row.asset_id,
    metadata: {
      resolution: input.resolution.slice(0, 200),
      event_disputed: input.mark_event_disputed,
    },
  });
}

/** Révocation administrative d'une validation, avec motif obligatoire. */
export async function adminRevokeEvent(
  admin: NidAdminContext,
  eventId: string,
  reason: string
): Promise<void> {
  const { data, error } = await nidService().rpc("nid_revoke_event", {
    p_event_id: eventId,
    p_actor_user_id: admin.user.id,
    p_actor_role: "administrateur",
    p_reason: reason,
  });
  if (error) throw new Error(dbErrorMessage(error, "La révocation a échoué."));
  const result = data as { state: string };
  if (result.state === "introuvable") throw new Error("Cet événement est introuvable.");
  if (result.state === "deja_revoque") throw new Error("Cet événement est déjà révoqué.");
}

/* ------------------------------------------------------------------ */
/*  Journal                                                            */
/* ------------------------------------------------------------------ */

export async function listAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error("nireo-id/admin audit", error);
    return [];
  }
  return (data ?? []) as AuditLogRow[];
}
