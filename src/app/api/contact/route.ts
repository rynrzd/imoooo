import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  getSupportEmail,
  isEmailProviderConfigured,
  sendEmail,
} from "@/lib/email/provider";
import { contactConfirmationEmail, contactCopyEmail } from "@/lib/email/templates";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nom requis.").max(100, "Nom trop long."),
  email: z.string().trim().email("E-mail invalide.").max(200),
  subject: z.string().trim().min(2, "Sujet requis.").max(150, "Sujet trop long."),
  message: z
    .string()
    .trim()
    .min(10, "Message trop court (10 caractères minimum).")
    .max(2000, "Message trop long (2 000 caractères maximum)."),
  // Champ piège anti-spam : invisible pour un humain, rempli par les robots.
  // Pas de contrainte ici — un piège rempli est traité silencieusement plus bas.
  website: z.string().max(500).optional(),
});

/**
 * POST /api/contact — formulaire de contact public.
 * 1. Le message est TOUJOURS stocké dans contact_messages (clé secrète,
 *    table sans policy RLS) : succès uniquement après insertion réelle.
 * 2. Si un fournisseur e-mail + SUPPORT_EMAIL sont configurés : copie au
 *    support (réponse directe possible via reply-to) et accusé de
 *    réception au demandeur — best effort, journalisé.
 * Anti-spam : validation stricte, champ piège, rate limit par IP.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured && !isEmailProviderConfigured) {
    return NextResponse.json(
      {
        error:
          "provider_not_configured : le formulaire de contact n'est pas opérationnel. " +
          "Écrivez-nous directement par e-mail.",
      },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`contact:${ip}`, 3, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Trop de messages envoyés. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Formulaire invalide.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { name, email, subject, message } = parsed.data;

  // Champ piège rempli : on répond 200 sans rien traiter (ne pas informer
  // le robot). Aucun utilisateur légitime n'est concerné — le champ est
  // invisible et vide dans le formulaire réel.
  if (parsed.data.website) {
    return NextResponse.json({ received: true });
  }

  // 1. Stockage (source de vérité).
  let storedId: string | null = null;
  if (isAdminConfigured) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("contact_messages")
        .insert({ name, email, subject, message })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      storedId = data.id as string;
    } catch (e) {
      logger.error("contact/store", e);
    }
  }

  // 2. E-mails (si fournisseur configuré) — jamais de succès simulé.
  let emailedSupport = false;
  const supportEmail = getSupportEmail();
  if (isEmailProviderConfigured && supportEmail) {
    const copy = contactCopyEmail(name, email, subject, message);
    try {
      await sendEmail({
        to: supportEmail,
        replyTo: email,
        subject: copy.subject,
        html: copy.html,
      });
      emailedSupport = true;
    } catch (e) {
      logger.error("contact/support-email", e);
    }
    // Accusé de réception au demandeur : best effort.
    const confirmation = contactConfirmationEmail(name, subject);
    try {
      await sendEmail({ to: email, subject: confirmation.subject, html: confirmation.html });
    } catch (e) {
      logger.error("contact/confirmation-email", e);
    }
  }

  if (storedId && emailedSupport) {
    // Trace le fait que le support a bien reçu la copie.
    try {
      const admin = createAdminClient();
      await admin.from("contact_messages").update({ status: "emailed" }).eq("id", storedId);
    } catch {
      // Non bloquant : le message est stocké et transmis.
    }
  }

  if (!storedId && !emailedSupport) {
    return NextResponse.json(
      { error: "Votre message n'a pas pu être transmis. Réessayez ou écrivez-nous par e-mail." },
      { status: 502 }
    );
  }

  return NextResponse.json({ received: true });
}
