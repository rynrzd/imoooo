import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import {
  contactConfirmationEmail,
  documentExpiringEmail,
  leaseExpiringEmail,
  maintenanceOverdueEmail,
  monthlyReportEmail,
  paymentReceivedEmail,
  rentDueSoonEmail,
  rentLateEmail,
  welcomeEmail,
  type EmailContent,
} from "@/lib/email/templates";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Modèles testables depuis Paramètres → données d'exemple clairement
 * marquées [TEST]. Le destinataire est TOUJOURS l'utilisateur connecté :
 * aucun destinataire arbitraire ne peut être fourni par le navigateur.
 */
const TEST_TEMPLATES: Record<string, (fullName: string) => EmailContent> = {
  bienvenue: (fullName) => welcomeEmail(fullName),
  contact_confirmation: (fullName) =>
    contactConfirmationEmail(fullName, "[TEST] Question produit"),
  loyer_bientot_du: () =>
    rentDueSoonEmail("[TEST] Appartement Exemple", "750,00 €", "le 5 du mois"),
  loyer_en_retard: () =>
    rentLateEmail({
      recipient: "owner",
      propertyName: "[TEST] Appartement Exemple",
      amount: "750,00 €",
      daysLate: 3,
    }),
  paiement_recu: () =>
    paymentReceivedEmail("[TEST] Appartement Exemple", "750,00 €", "ce mois-ci"),
  bail_bientot_expire: () =>
    leaseExpiringEmail("[TEST] Appartement Exemple", "31/12/2026"),
  document_bientot_expire: () =>
    documentExpiringEmail("[TEST] Assurance PNO", "[TEST] Appartement Exemple", "31/12/2026"),
  travaux_en_retard: () =>
    maintenanceOverdueEmail("[TEST] Remplacement chaudière", "[TEST] Appartement Exemple"),
  rapport_mensuel: () =>
    monthlyReportEmail({
      monthLabel: "ce mois-ci (test)",
      revenue: "1 500,00 €",
      expenses: "320,00 €",
      net: "1 180,00 €",
      occupancy: "100 %",
      propertiesCount: 2,
      latePayments: 0,
      lateAmount: "0,00 €",
      newWorks: 1,
    }),
};

/**
 * POST /api/test-email — { template } (identifiant d'un modèle connu).
 * Envoie le modèle choisi à l'adresse de l'utilisateur connecté, préfixé
 * [TEST]. Journalisé dans email_logs. 503 explicite sans fournisseur —
 * jamais de succès simulé.
 */
export async function POST(request: Request) {
  if (!isEmailProviderConfigured) {
    return NextResponse.json(
      {
        error:
          "provider_not_configured : aucun fournisseur e-mail n'est configuré " +
          "(EMAIL_PROVIDER + clé + expéditeur). Aucun envoi possible.",
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

  // 5 e-mails de test par heure et par utilisateur.
  if (!checkRateLimit(`test-email:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Limite atteinte : 5 e-mails de test par heure. Réessayez plus tard." },
      { status: 429 }
    );
  }

  let template: unknown;
  try {
    ({ template } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const factory =
    typeof template === "string" ? TEST_TEMPLATES[template] : undefined;
  if (!factory) {
    return NextResponse.json({ error: "Modèle d'e-mail inconnu." }, { status: 400 });
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() || "";
  const content = factory(fullName);
  const subject = `[TEST] ${content.subject}`;

  try {
    await sendEmail({ to: user.email, subject, html: content.html });
  } catch (e) {
    logger.error("test-email/send", e);
    await supabase.from("email_logs").insert({
      user_id: user.id,
      kind: "test_email",
      recipient: user.email,
      subject,
      status: "failed",
      error: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "L'envoi a échoué côté fournisseur. Aucun e-mail n'est parti." },
      { status: 502 }
    );
  }

  await supabase.from("email_logs").insert({
    user_id: user.id,
    kind: "test_email",
    recipient: user.email,
    subject,
    status: "sent",
  });

  return NextResponse.json({ sent: true, recipient: user.email });
}
