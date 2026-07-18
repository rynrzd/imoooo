import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { getSubscription } from "@/lib/stripe/subscription";
import { SITE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/portal — ouvre le portail client Stripe (factures,
 * moyen de paiement, changement ou résiliation d'abonnement).
 */
export async function POST() {
  if (!isStripeConfigured) {
    return NextResponse.json(
      { error: "Le paiement en ligne n'est pas encore disponible." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  }

  try {
    const subscription = await getSubscription(supabase, user.id);
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Aucun abonnement à gérer : souscrivez d'abord un plan." },
        { status: 404 }
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${SITE_URL}/abonnement`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("[stripe/portal]", e);
    return NextResponse.json(
      { error: "Ouverture du portail de facturation impossible. Réessayez." },
      { status: 500 }
    );
  }
}
