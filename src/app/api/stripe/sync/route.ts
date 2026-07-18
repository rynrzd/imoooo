import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import {
  getSubscription,
  resolvePlan,
  syncSubscriptionToDatabase,
} from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/sync — resynchronise l'abonnement de l'utilisateur
 * connecté depuis Stripe (filet de sécurité si un webhook a été manqué,
 * ou juste après le retour de Checkout).
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
    const stripe = getStripe();
    const row = await getSubscription(supabase, user.id);

    // L'abonnement est retrouvé chez Stripe (source de vérité), dans l'ordre :
    // id stocké → client Stripe stocké → recherche par metadata user_id.
    // Indispensable quand le webhook n'a pas encore écrit la ligne (retard,
    // secret absent en local) : sans cela le compte restait « free » à tort.
    let subscription = null;
    if (row?.stripe_subscription_id) {
      subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    } else if (row?.stripe_customer_id) {
      const list = await stripe.subscriptions.list({
        customer: row.stripe_customer_id,
        status: "all",
        limit: 1,
      });
      subscription = list.data[0] ?? null;
    } else {
      const found = await stripe.subscriptions.search({
        query: `metadata['user_id']:'${user.id}'`,
        limit: 1,
      });
      subscription = found.data[0] ?? null;
    }

    if (!subscription) {
      return NextResponse.json({ plan: "free", status: "none" });
    }
    await syncSubscriptionToDatabase(createAdminClient(), user.id, subscription);

    const updated = await getSubscription(supabase, user.id);
    return NextResponse.json({
      plan: resolvePlan(updated).id,
      status: updated?.status ?? "none",
      currentPeriodEnd: updated?.current_period_end ?? null,
      cancelAtPeriodEnd: updated?.cancel_at_period_end ?? false,
    });
  } catch (e) {
    logger.error("[stripe/sync]", e);
    return NextResponse.json(
      { error: "Synchronisation de l'abonnement impossible. Réessayez." },
      { status: 500 }
    );
  }
}
