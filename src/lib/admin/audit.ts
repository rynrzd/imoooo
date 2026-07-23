import { headers } from "next/headers";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { AdminContext } from "./auth";

/**
 * Journal d'audit administrateur — chaque action sensible est enregistrée
 * dans `admin_audit_logs` (admin concerné, action, cible, valeurs avant/
 * après, IP, résultat). L'écriture d'audit ne doit JAMAIS faire échouer
 * l'action métier : toute erreur est loguée puis avalée.
 */

export interface AuditEntry {
  action: string;
  targetUserId?: string | null;
  targetLabel?: string;
  oldValue?: unknown;
  newValue?: unknown;
  result?: "success" | "error";
  detail?: string;
}

/** IP du client si le proxy/hébergeur la transmet (best-effort). */
async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

export async function logAdminAction(
  ctx: AdminContext | null,
  entry: AuditEntry
): Promise<void> {
  if (!isAdminConfigured) return;
  try {
    const { error } = await createAdminClient().from("admin_audit_logs").insert({
      admin_user_id: ctx?.admin.id ?? null,
      admin_email: ctx?.user.email ?? "",
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_label: entry.targetLabel ?? "",
      old_value: entry.oldValue === undefined ? null : entry.oldValue,
      new_value: entry.newValue === undefined ? null : entry.newValue,
      ip: await clientIp(),
      result: entry.result ?? "success",
      detail: entry.detail ?? "",
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    logger.error("admin/audit", e);
  }
}

/** Tentative de connexion admin (réussie ou refusée) — toujours journalisée. */
export async function logAdminLogin(
  email: string,
  success: boolean,
  detail = ""
): Promise<void> {
  if (!isAdminConfigured) return;
  try {
    const { error } = await createAdminClient().from("admin_audit_logs").insert({
      admin_email: email,
      action: success ? "admin.login" : "admin.login_refused",
      ip: await clientIp(),
      result: success ? "success" : "error",
      detail,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    logger.error("admin/audit", e);
  }
}
