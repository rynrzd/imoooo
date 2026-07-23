"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { FOUNDER_TOTAL_PLACES } from "@/config/plans";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import { getSiteSettings, writeSiteSetting } from "../settings";
import type { ActionResult } from "../types";

/**
 * Server Actions — configuration du site (table site_settings).
 * Réservées au rôle owner/admin. Chaque modification est journalisée
 * (ancienne et nouvelle valeur). Aucun secret ne transite par ici.
 */

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

async function update(
  key: "announcement_message" | "maintenance_mode" | "support_email",
  value: string | boolean,
  action = "settings.update"
): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const before = await getSiteSettings();
    await writeSiteSetting(key, value, ctx.admin.id);
    await logAdminAction(ctx, {
      action,
      targetLabel: key,
      oldValue: { [key]: before[key] },
      newValue: { [key]: value },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Paramètre enregistré." };
  } catch (e) {
    logger.error("admin/settings", e);
    await logAdminAction(ctx, {
      action,
      targetLabel: key,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

/** Message d'annonce global (bandeau landing + application ; vide = masqué). */
export async function updateAnnouncement(message: string): Promise<ActionResult> {
  const trimmed = message.trim();
  if (trimmed.length > 300) return { ok: false, error: "Message trop long (300 max)." };
  return update("announcement_message", trimmed);
}

/** Mode maintenance : ferme l'espace client (l'admin reste accessible). */
export async function setMaintenanceMode(enabled: boolean): Promise<ActionResult> {
  return update("maintenance_mode", enabled);
}

/** Adresse e-mail de support affichée sur la page Contact. */
export async function setSupportEmail(email: string): Promise<ActionResult> {
  const trimmed = email.trim();
  if (trimmed && !EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Adresse e-mail invalide." };
  }
  return update("support_email", trimmed);
}

/**
 * Configuration de l'offre Fondateur : activation + nombre de places.
 * Plafond ABSOLU : 100 places (imposé ici ET côté lecture).
 */
export async function setFounderConfig(
  enabled: boolean,
  maxPlaces: number
): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const places = Math.trunc(maxPlaces);
    if (!Number.isFinite(places) || places < 0) {
      return { ok: false, error: "Nombre de places invalide." };
    }
    if (places > FOUNDER_TOTAL_PLACES) {
      return { ok: false, error: `Maximum absolu : ${FOUNDER_TOTAL_PLACES} places.` };
    }
    const before = await getSiteSettings();
    await writeSiteSetting("founder_enabled", enabled, ctx.admin.id);
    await writeSiteSetting("founder_max_places", places, ctx.admin.id);
    await logAdminAction(ctx, {
      action: "founder.config",
      oldValue: {
        founder_enabled: before.founder_enabled,
        founder_max_places: before.founder_max_places,
      },
      newValue: { founder_enabled: enabled, founder_max_places: places },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Configuration Fondateur enregistrée." };
  } catch (e) {
    logger.error("admin/settings", e);
    await logAdminAction(ctx, {
      action: "founder.config",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}
