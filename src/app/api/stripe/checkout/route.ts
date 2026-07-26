import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import { isUserAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { attachPartnerAttribution, REF_COOKIE_NAME } from "@/lib/marketing/referral";
import { validatePromoCode } from "@/lib/promo/preview";
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

  // Attribution partenaire : filet de sécurité si le rattachement n'a pas
  // eu lieu à la confirmation d'e-mail (autre appareil, session directe…).
  // First-touch et idempotent — l'attribution n'est jamais perdue pendant
  // le parcours de paiement. Jamais bloquant.
  try {
    const refCookie = (await cookies()).get(REF_COOKIE_NAME)?.value;
    if (refCookie) {
      await attachPartnerAttribution(user.id, refCookie);
    }
  } catch (e) {
    logger.error("[stripe/checkout] attribution partenaire", e);
  }

  let plan: unknown;
  let promoCode: unknown;
  try {
    ({ plan, promoCode } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof plan !== "string" || !isPaidPlanId(plan)) {
    return NextResponse.json({ error: "Plan inconnu." }, { status: 400 });
  }

  // Code promo : revalidé CÔTÉ SERVEUR pour ce plan précis (le navigateur ne
  // fixe jamais la réduction). Un code invalide/inéligible bloque le paiement
  // avec un message clair — jamais de réduction non prévue ni de contournement.
  let stripePromotionCodeId: string | null = null;
  if (typeof promoCode === "string" && promoCode.trim().length > 0) {
    const result = await validatePromoCode(createAdminClient(), promoCode, plan);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    stripePromotionCodeId = result.value.promo.stripe_promotion_code_id;
    if (!stripePromotionCodeId) {
      return NextResponse.json(
        { error: "Ce code n'est pas applicable au paiement en ligne." },
        { status: 422 }
      );
    }
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

    // `discounts` et `allow_promotion_codes` sont exclusifs chez Stripe :
    // code appliqué en amont → on le transmet ; sinon → champ code sur la
    // page Stripe (l'utilisateur peut toujours en saisir un là-bas).
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: getPriceIdForPlan(plan), quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      ...(stripePromotionCodeId
        ? { discounts: [{ promotion_code: stripePromotionCodeId }] }
        : { allow_promotion_codes: true }),
      success_url: `${SITE_URL}/abonnement?checkout=success`,
      cancel_url: `${SITE_URL}/abonnement?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe n'a pas retourné d'URL de paiement." },
        { status: 502 }
      );
    }
    // Analytics : démarrage d'un paiement (best-effort, jamais bloquant).
    await recordAnalyticsEvent("payment_started", { userId: user.id, plan });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("[stripe/checkout]", e);
    return NextResponse.json(
      { error: "Création de la session de paiement impossible. Réessayez." },
      { status: 500 }
    );
  }
}
