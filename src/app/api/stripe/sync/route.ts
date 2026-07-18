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
    const row = await getSubscription(supabase, user.id);
    if (!row?.stripe_subscription_id) {
      return NextResponse.json({ plan: "free", status: "none" });
    }

    const subscription = await getStripe().subscriptions.retrieve(
      row.stripe_subscription_id
    );
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
