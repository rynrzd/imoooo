import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import { rentLateEmail } from "@/lib/email/templates";
import { formatCurrency } from "@/lib/format";
import { checkRateLimit } from "@/lib/rate-limit";
import { userHasFeature } from "@/lib/stripe/subscription";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PaymentRow {
  id: string;
  month: string;
  expected: number | string;
  received: number | string;
  status: string;
  leases: {
    tenants: { first_name: string; last_name: string; email: string | null } | null;
    properties: { name: string } | null;
  } | null;
}

/**
 * POST /api/rent-reminder — { paymentId, customMessage? }
 * Relance MANUELLE d'un loyer réellement en retard : e-mail au locataire,
 * copie au propriétaire, journalisée dans email_logs + notification interne.
 * Aucun envoi (ni faux succès) sans fournisseur configuré.
 */
export async function POST(request: Request) {
  if (!isEmailProviderConfigured) {
    return NextResponse.json(
      {
        error:
          "provider_not_configured : aucun fournisseur e-mail n'est configuré " +
          "(EMAIL_PROVIDER + clé + EMAIL_FROM). Aucun envoi possible.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  }

  // Relance manuelle par e-mail : incluse à partir du plan Starter.
  // Le plan est lu en base (subscriptions/RLS), jamais depuis le client.
  if (!(await userHasFeature(supabase, user.id, "manual_reminders"))) {
    return NextResponse.json(
      {
        error:
          "Les relances par e-mail sont incluses à partir du plan Starter. " +
          "Passez à un plan supérieur pour les activer.",
      },
      { status: 403 }
    );
  }

  let paymentId: unknown;
  let customMessage: unknown;
  try {
    ({ paymentId, customMessage } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof paymentId !== "string") {
    return NextResponse.json({ error: "Identifiant de paiement requis." }, { status: 400 });
  }

  // Lecture via la session utilisateur : la RLS garantit la propriété.
  const { data, error } = await supabase
    .from("rent_payments")
    .select(
      "id, month, expected, received, status, leases (tenants (first_name, last_name, email), properties (name))"
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Échéance introuvable." }, { status: 404 });
  }
  const payment = data as unknown as PaymentRow;
  if (payment.status !== "retard") {
    return NextResponse.json(
      { error: "Cette échéance n'est pas en retard : aucune relance à envoyer." },
      { status: 400 }
    );
  }
  const tenant = payment.leases?.tenants;
  if (!tenant?.email) {
    return NextResponse.json(
      { error: "Le locataire n'a pas d'adresse e-mail enregistrée." },
      { status: 400 }
    );
  }

  // Anti double-clic : une tentative par échéance par minute.
  if (!checkRateLimit(`rent-reminder:${user.id}:${payment.id}`, 1, 60_000)) {
    return NextResponse.json(
      { error: "Une relance vient d'être demandée pour cette échéance. Patientez une minute." },
      { status: 429 }
    );
  }

  // Anti-doublon explicite : une relance manuelle par échéance et par jour.
  const dedupeKey = `rent_late_manual:${payment.id}:${new Date().toISOString().slice(0, 10)}`;
  const { data: alreadySent } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("dedupe_key", dedupeKey)
    .eq("status", "sent")
    .maybeSingle();
  if (alreadySent) {
    return NextResponse.json(
      { error: "Une relance a déjà été envoyée aujourd'hui pour cette échéance. Réessayez demain." },
      { status: 409 }
    );
  }

  const propertyName = payment.leases?.properties?.name ?? "votre logement";
  const remaining = Number(payment.expected) - Number(payment.received);
  const daysLate = Math.max(
    1,
    Math.floor((Date.now() - new Date(`${payment.month.slice(0, 7)}-01`).getTime()) / 86_400_000)
  );
  // Message personnalisé : réservé au plan Pro (custom_email_templates).
  // Sans ce plan, il est ignoré — le modèle standard est envoyé.
  const canCustomize = await userHasFeature(supabase, user.id, "custom_email_templates");
  const content = rentLateEmail({
    recipient: "tenant",
    propertyName,
    amount: formatCurrency(remaining),
    daysLate,
    customMessage:
      canCustomize && typeof customMessage === "string" && customMessage.trim()
        ? customMessage.trim()
        : null,
  });

  try {
    await sendEmail({ to: tenant.email, cc: user.email, subject: content.subject, html: content.html });
  } catch (e) {
    logger.error("rent-reminder/send", e);
    await supabase.from("email_logs").insert({
      user_id: user.id,
      kind: "rent_late_manual",
      recipient: tenant.email,
      subject: content.subject,
      status: "failed",
      error: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "L'envoi a échoué côté fournisseur. Aucun e-mail n'est parti." },
      { status: 502 }
    );
  }

  // Journal + notification interne (après retour fournisseur uniquement).
  await supabase.from("email_logs").insert({
    user_id: user.id,
    kind: "rent_late_manual",
    recipient: tenant.email,
    subject: content.subject,
    status: "sent",
    dedupe_key: dedupeKey,
  });
  await supabase.from("notifications").insert({
    user_id: user.id,
    title: `Relance envoyée — ${propertyName}`,
    description: `Rappel de loyer envoyé à ${tenant.first_name} ${tenant.last_name} (${formatCurrency(remaining)} restant dû).`,
    category: "loyers",
    priority: "normale",
    href: "/loyers",
    dedupe_key: `rent_reminder_sent:${payment.id}:${Date.now()}`,
  });

  return NextResponse.json({ sent: true, recipient: tenant.email });
}
