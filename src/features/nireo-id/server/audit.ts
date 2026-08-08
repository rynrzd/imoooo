import { logger } from "@/lib/logger";
import { isNireoIdConfigured, nidService } from "./client";

/**
 * Journal d'audit Nireo ID — append-only.
 *
 * On n'y écrit JAMAIS le contenu d'un document, un jeton, ni une adresse
 * e-mail complète : uniquement l'acteur, l'action, la cible et quelques
 * métadonnées minimales utiles à une enquête.
 * L'écriture n'est jamais bloquante : une panne de journal ne doit pas
 * empêcher un utilisateur d'agir sur ses propres données.
 */

export interface AuditEntry {
  actorUserId?: string | null;
  actorRole?: "utilisateur" | "professionnel" | "administrateur" | "systeme";
  action: string;
  targetType?: string;
  targetId?: string | null;
  assetId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordNidAudit(entry: AuditEntry): Promise<void> {
  if (!isNireoIdConfigured) return;
  try {
    await nidService().from("nid_audit_logs").insert({
      actor_user_id: entry.actorUserId ?? null,
      actor_role: entry.actorRole ?? "utilisateur",
      action: entry.action,
      target_type: entry.targetType ?? "",
      target_id: entry.targetId ?? null,
      asset_id: entry.assetId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    logger.error("nireo-id/audit", error);
  }
}
