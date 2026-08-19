"use server";

import { revalidatePath } from "next/cache";
import { isEmailConfigured, sendEmail } from "@/lib/email/provider";
import { customEmail } from "@/lib/email/templates";
import { fillVariables, variableValues } from "@/lib/email/variables";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import {
  coerceTemplates,
  EMAIL_TEMPLATES_KEY,
  getEmailTemplates,
  getRecipient,
  searchRecipients,
  type EmailRecipient,
  type EmailTemplate,
} from "../emails";
import { readSiteSettingRaw, writeSiteSettingRaw, type SettingValue } from "../settings";
import type { ActionResult } from "../types";

/**
 * Server Actions de l'espace Emails.
 *
 * Toutes passent par `requireAdminAction` : connaître l'URL d'une action ne
 * suffit pas à l'appeler, le rôle est revérifié en base à chaque invocation.
 * Aucune clé de fournisseur ne franchit jamais cette frontière — le
 * navigateur n'apprend que « parti » ou « échoué ».
 */

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

/* ------------------------------------------------------------------ */
/* Destinataires                                                       */
/* ------------------------------------------------------------------ */

/** Recherche d'un destinataire depuis l'éditeur (réservée aux admins). */
export async function searchRecipientsAction(q: string): Promise<EmailRecipient[]> {
  await requireAdminAction(["admin", "support"]);
  try {
    return await searchRecipients(q);
  } catch (e) {
    logger.error("admin/emails search", e);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Envoi                                                               */
/* ------------------------------------------------------------------ */

export interface SendAdminEmailInput {
  userId: string;
  subject: string;
  body: string;
  /**
   * Jeton d'idempotence produit par l'éditeur, constant tant que le message
   * n'a pas changé. C'est lui qui rend un double-clic inoffensif.
   */
  token: string;
}

/**
 * Envoie un e-mail rédigé dans l'administration.
 *
 * ORDRE VOLONTAIRE — la ligne d'historique est écrite AVANT l'appel au
 * fournisseur, en statut « échec / envoi non confirmé », puis basculée en
 * « envoyé » seulement si le fournisseur a accepté :
 *
 * - la contrainte `unique (user_id, dedupe_key)` transforme cette écriture en
 *   verrou : un second appel avec le même jeton est refusé par la base, donc
 *   le destinataire ne reçoit jamais deux fois le même message, même si deux
 *   requêtes partent en parallèle ;
 * - si le serveur meurt entre la réservation et la confirmation, la ligne
 *   reste en échec. C'est la vérité : personne ne peut affirmer que
 *   l'e-mail est parti. L'inverse (écrire « envoyé » d'avance) afficherait
 *   un succès imaginaire.
 */
export async function sendAdminEmail(input: SendAdminEmailInput): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);

    const subject = input.subject.trim();
    const body = input.body.trim();
    const token = input.token.trim();

    if (!subject) return { ok: false, error: "Le sujet est obligatoire." };
    if (subject.length > SUBJECT_MAX) {
      return { ok: false, error: `Sujet trop long (${SUBJECT_MAX} caractères maximum).` };
    }
    if (!body) return { ok: false, error: "Le message est vide." };
    if (body.length > BODY_MAX) {
      return { ok: false, error: `Message trop long (${BODY_MAX} caractères maximum).` };
    }
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(token)) {
      return { ok: false, error: "Requête invalide : rechargez la page." };
    }

    if (!isEmailConfigured) {
      return {
        ok: false,
        error:
          "Aucun fournisseur e-mail n'est configuré sur ce serveur : l'envoi est impossible.",
      };
    }

    const recipient = await getRecipient(input.userId);
    if (!recipient) return { ok: false, error: "Destinataire introuvable." };
    if (!recipient.email) {
      return { ok: false, error: "Ce compte n'a pas d'adresse e-mail enregistrée." };
    }

    // Le remplacement a lieu sur le texte brut ; `customEmail` échappe
    // ensuite l'ensemble. Un nom contenant du HTML ne peut rien injecter.
    const values = variableValues(recipient);
    const finalSubject = fillVariables(subject, values);
    const content = customEmail(finalSubject, fillVariables(body, values));

    const admin = createAdminClient();
    const { data: reservation, error: reserveError } = await admin
      .from("email_logs")
      .insert({
        user_id: recipient.id,
        kind: "admin_manual",
        recipient: recipient.email,
        subject: finalSubject,
        status: "failed",
        error: "Envoi non confirmé.",
        dedupe_key: `admin:${token}`,
      })
      .select("id")
      .single();

    if (reserveError) {
      // 23505 = violation d'unicité : ce message a déjà été réservé.
      if (reserveError.code === "23505") {
        return { ok: false, error: "Ce message a déjà été envoyé à ce destinataire." };
      }
      throw new Error(reserveError.message);
    }

    const logId = reservation.id as string;

    try {
      await sendEmail({ to: recipient.email, subject: content.subject, html: content.html });
    } catch (sendError) {
      const detail =
        sendError instanceof Error ? sendError.message : "Erreur inconnue du fournisseur.";
      // La réservation est LIBÉRÉE (`dedupe_key` remise à null) : rien n'est
      // parti, réessayer le même message doit rester possible. La ligne, elle,
      // reste dans l'historique en échec — un envoi raté ne s'efface pas.
      await admin
        .from("email_logs")
        .update({ error: detail, dedupe_key: null })
        .eq("id", logId);
      await logAdminAction(ctx, {
        action: "email.send",
        targetUserId: recipient.id,
        targetLabel: recipient.email,
        result: "error",
        detail,
      });
      revalidatePath("/admin/emails");
      return { ok: false, error: `L'envoi a échoué : ${detail}` };
    }

    const { error: confirmError } = await admin
      .from("email_logs")
      .update({ status: "sent", error: null })
      .eq("id", logId);
    // L'e-mail est parti : on ne transforme pas un succès réel en échec
    // affiché parce que la ligne d'historique n'a pas pu être mise à jour.
    if (confirmError) logger.error("admin/emails confirm", confirmError.message);

    await logAdminAction(ctx, {
      action: "email.send",
      targetUserId: recipient.id,
      targetLabel: recipient.email,
      newValue: { subject: finalSubject },
    });
    revalidatePath("/admin/emails");
    return { ok: true, message: `Message envoyé à ${recipient.email}.` };
  } catch (e) {
    logger.error("admin/emails send", e);
    await logAdminAction(ctx, {
      action: "email.send",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Envoi impossible." };
  }
}

/* ------------------------------------------------------------------ */
/* Modèles                                                             */
/* ------------------------------------------------------------------ */

/** Identifiant stable et lisible, sans dépendance ajoutée. */
function newTemplateId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Écrit la liste complète des modèles.
 *
 * La relecture juste avant l'écriture limite la fenêtre pendant laquelle
 * deux administrateurs qui éditent en même temps s'écraseraient — le
 * stockage est un document JSON unique, il n'y a pas de verrou par ligne.
 */
async function writeTemplates(
  adminId: string,
  mutate: (current: EmailTemplate[]) => EmailTemplate[] | { error: string }
): Promise<ActionResult> {
  const current = coerceTemplates(await readSiteSettingRaw<unknown>(EMAIL_TEMPLATES_KEY, null));
  const next = mutate(current);
  if (!Array.isArray(next)) return { ok: false, error: next.error };
  await writeSiteSettingRaw(
    EMAIL_TEMPLATES_KEY,
    { items: next } as unknown as SettingValue,
    adminId
  );
  revalidatePath("/admin/emails");
  return { ok: true };
}

export interface SaveTemplateInput {
  /** Vide = création. */
  id?: string;
  name: string;
  subject: string;
  body: string;
}

export async function saveEmailTemplate(input: SaveTemplateInput): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const name = input.name.trim().slice(0, 80);
    const subject = input.subject.trim().slice(0, SUBJECT_MAX);
    const body = input.body.trim().slice(0, BODY_MAX);
    if (!name) return { ok: false, error: "Donnez un nom au modèle." };
    if (!subject) return { ok: false, error: "Le sujet est obligatoire." };
    if (!body) return { ok: false, error: "Le message est vide." };

    const result = await writeTemplates(ctx.admin.id, (items) => {
      const now = new Date().toISOString();
      if (input.id) {
        const index = items.findIndex((t) => t.id === input.id);
        if (index === -1) return { error: "Ce modèle n'existe plus." };
        const next = [...items];
        next[index] = { ...next[index]!, name, subject, body, updated_at: now };
        return next;
      }
      if (items.length >= 50) return { error: "Maximum 50 modèles." };
      return [...items, { id: newTemplateId(), name, subject, body, updated_at: now }];
    });

    if (result.ok) {
      await logAdminAction(ctx, {
        action: input.id ? "email.template_update" : "email.template_create",
        targetLabel: name,
      });
      return { ok: true, message: input.id ? "Modèle enregistré." : "Modèle créé." };
    }
    return result;
  } catch (e) {
    logger.error("admin/emails template", e);
    await logAdminAction(ctx, {
      action: "email.template_update",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

export async function duplicateEmailTemplate(id: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const result = await writeTemplates(ctx.admin.id, (items) => {
      const source = items.find((t) => t.id === id);
      if (!source) return { error: "Ce modèle n'existe plus." };
      if (items.length >= 50) return { error: "Maximum 50 modèles." };
      return [
        ...items,
        {
          ...source,
          id: newTemplateId(),
          name: `${source.name} (copie)`.slice(0, 80),
          updated_at: new Date().toISOString(),
        },
      ];
    });
    if (result.ok) {
      await logAdminAction(ctx, { action: "email.template_create", targetLabel: id });
      return { ok: true, message: "Modèle dupliqué." };
    }
    return result;
  } catch (e) {
    logger.error("admin/emails template", e);
    return { ok: false, error: e instanceof Error ? e.message : "Duplication impossible." };
  }
}

export async function deleteEmailTemplate(id: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const before = await getEmailTemplates();
    const target = before.find((t) => t.id === id);
    const result = await writeTemplates(ctx.admin.id, (items) => {
      if (!items.some((t) => t.id === id)) return { error: "Ce modèle n'existe plus." };
      return items.filter((t) => t.id !== id);
    });
    if (result.ok) {
      await logAdminAction(ctx, {
        action: "email.template_delete",
        targetLabel: target?.name ?? id,
        oldValue: target ?? null,
      });
      return { ok: true, message: "Modèle supprimé." };
    }
    return result;
  } catch (e) {
    logger.error("admin/emails template", e);
    return { ok: false, error: e instanceof Error ? e.message : "Suppression impossible." };
  }
}
