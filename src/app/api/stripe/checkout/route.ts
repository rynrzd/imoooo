import { NextResponse } from "next/server";
import { isUserAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { getPriceIdForPlan, isStripeConfigured } from "@/lib/stripe/config";
import { isPaidPlanId } from "@/lib/stripe/plans";
import { getStripe } from "@/lib/stripe/server";
import { getSubscription } from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/checkout — { plan: "starter" | "pro" | "business" }
 * Crée une session Stripe Checkout (abonnement mensuel) pour l'utilisateur
 * connecté et retourne son URL de paiement.
 */
export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Connectez-vous pour vous abonner." }, { status: 401 });
  }

  // Un administrateur n'est pas un client Nireo : aucun abonnement possible.
  if (await isUserAdmin(user.id)) {
    return NextResponse.json(
      { error: "Un compte administrateur ne peut pas souscrire d'abonnement." },
      { status: 403 }
    );
  }

  let plan: unknown;
  try {
    ({ plan } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof plan !== "string" || !isPaidPlanId(plan)) {
    return NextResponse.json({ error: "Plan inconnu." }, { status: 400 });
  }

  try {
    const stripe = getStripe();

    // Client Stripe réutilisé s'il existe déjà (évite les doublons).
    const existing = await getSubscription(supabase, user.id);
    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      // Mémorisé immédiatement : /api/stripe/sync peut ainsi retrouver
      // l'abonnement au retour de Checkout même si le webhook n'a pas
      // encore été livré. Non bloquant : le webhook réécrira la ligne.
      const { error: saveError } = await createAdminClient()
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
      if (saveError) {
        logger.error("[stripe/checkout] enregistrement stripe_customer_id", saveError);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: getPriceIdForPlan(plan), quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/abonnement?checkout=success`,
      cancel_url: `${SITE_URL}/abonnement?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe n'a pas retourné d'URL de paiement." },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("[stripe/checkout]", e);
    return NextResponse.json(
      { error: "Création de la session de paiement impossible. Réessayez." },
      { status: 500 }
    );
  }
}
