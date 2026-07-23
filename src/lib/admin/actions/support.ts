"use server";

import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/email/provider";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import type { ActionResult } from "../types";

/**
 * Server Actions — support (table contact_messages, colonnes admin).
 * Le rôle support (et au-dessus) peut traiter les tickets.
 */

const STATUSES = ["ouvert", "en_cours", "resolu", "ferme"] as const;
const PRIORITIES = ["basse", "normale", "haute"] as const;

async function loadTicket(id: string) {
  const { data, error } = await createAdminClient()
    .from("contact_messages")
    .select("id, name, email, subject, admin_status, priority")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ticket introuvable.");
  return data;
}

export async function setTicketStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction(["admin", "support"]);
    if (!(STATUSES as readonly string[]).includes(status)) {
      return { ok: false, error: "Statut inconnu." };
    }
    const ticket = await loadTicket(id);
    const { error } = await createAdminClient()
      .from("contact_messages")
      .update({ admin_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await logAdminAction(ctx, {
      action: "support.status",
      targetLabel: `${ticket.email} — ${ticket.subject}`,
      oldValue: { status: ticket.admin_status },
      newValue: { status },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Statut mis à jour." };
  } catch (e) {
    logger.error("admin/support", e);
    return { ok: false, error: e instanceof Error ? e.message : "Mise à jour impossible." };
  }
}

export async function setTicketPriority(id: string, priority: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction(["admin", "support"]);
    if (!(PRIORITIES as readonly string[]).includes(priority)) {
      return { ok: false, error: "Priorité inconnue." };
    }
    const ticket = await loadTicket(id);
    const { error } = await createAdminClient()
      .from("contact_messages")
      .update({ priority, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await logAdminAction(ctx, {
      action: "support.priority",
      targetLabel: `${ticket.email} — ${ticket.subject}`,
      oldValue: { priority: ticket.priority },
      newValue: { priority },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Priorité mise à jour." };
  } catch (e) {
    logger.error("admin/support", e);
    return { ok: false, error: e instanceof Error ? e.message : "Mise à jour impossible." };
  }
}

export async function setTicketNote(id: string, note: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction(["admin", "support"]);
    if (note.length > 2000) return { ok: false, error: "Note trop longue (2000 max)." };
    const ticket = await loadTicket(id);
    const { error } = await createAdminClient()
      .from("contact_messages")
      .update({ internal_note: note.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await logAdminAction(ctx, {
      action: "support.note",
      targetLabel: `${ticket.email} — ${ticket.subject}`,
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Note enregistrée." };
  } catch (e) {
    logger.error("admin/support", e);
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

/** Réponse par e-mail (fournisseur configuré requis — jamais de simulation). */
export async function replyToTicket(id: string, message: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction(["admin", "support"]);
    const trimmed = message.trim();
    if (!trimmed) return { ok: false, error: "La réponse est vide." };
    if (trimmed.length > 5000) return { ok: false, error: "Réponse trop longue (5000 max)." };
    if (!isEmailConfigured) {
      return {
        ok: false,
        error:
          "Aucun fournisseur d'e-mail configuré (EMAIL_PROVIDER + clé API) : " +
          "impossible d'envoyer la réponse.",
      };
    }
    const ticket = await loadTicket(id);

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    await sendEmail({
      to: ticket.email as string,
      subject: `Re: ${ticket.subject}`,
      html: `<p>Bonjour ${escapeHtml((ticket.name as string) || "")},</p><p>${escapeHtml(
        trimmed
      ).replace(/\n/g, "<br />")}</p><p>— L'équipe Nireo</p>`,
    });

    const { error } = await createAdminClient()
      .from("contact_messages")
      .update({
        replied_at: new Date().toISOString(),
        admin_status: "en_cours",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await logAdminAction(ctx, {
      action: "support.reply",
      targetLabel: `${ticket.email} — ${ticket.subject}`,
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Réponse envoyée." };
  } catch (e) {
    logger.error("admin/support", e);
    return { ok: false, error: e instanceof Error ? e.message : "Envoi impossible." };
  }
}
