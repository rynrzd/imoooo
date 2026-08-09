import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { handleNidStripeEvent, nidWebhookSecret } from "@/features/nireo-id/server/billing";

export const runtime = "nodejs";

/**
 * POST /api/nireo-id/stripe/webhook — webhook PROPRE à Nireo ID.
 *
 * Endpoint distinct de celui de Nireo Immo : secret de signature séparé
 * (NIREO_ID_STRIPE_WEBHOOK_SECRET), Price IDs séparés, aucun droit croisé
 * entre les deux produits. La signature est toujours vérifiée : un corps
 * non signé n'active jamais un abonnement.
 */
export async function POST(request: Request) {
  const secret = nidWebhookSecret();
  if (!isStripeConfigured || !secret) {
    return NextResponse.json(
      {
        error:
          "provider_not_configured : STRIPE_SECRET_KEY ou NIREO_ID_STRIPE_WEBHOOK_SECRET absent — webhook Nireo ID inactif.",
      },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    logger.error("nireo-id/webhook signature", error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    const outcome = await handleNidStripeEvent(event);
    return NextResponse.json({ received: true, ...outcome });
  } catch (error) {
    logger.error("nireo-id/webhook", error);
    // 500 : Stripe réessaiera, et l'idempotence évite tout double effet.
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }
}
