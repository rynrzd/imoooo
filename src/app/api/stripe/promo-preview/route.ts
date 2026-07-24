import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { applyPromoDiscount, PLANS } from "@/config/plans";
import { checkRateLimit } from "@/lib/rate-limit";
import { validatePromoCode } from "@/lib/promo/preview";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/promo-preview — { code }
 * Valide un code promo CÔTÉ SERVEUR et retourne, pour AFFICHAGE, la réduction
 * et les prix remisés par plan éligible. Le navigateur ne fixe jamais le
 * montant : la réduction réelle est appliquée par Stripe au paiement, et le
 * code est revalidé lors de la création de la session Checkout.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured || !isAdminConfigured) {
    return NextResponse.json(
      { error: "Les codes promo ne sont pas disponibles pour le moment." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour appliquer un code." }, { status: 401 });
  }

  // Anti-énumération : 10 essais / minute / utilisateur.
  if (!checkRateLimit(`promo-preview:${user.id}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Trop d'essais. Patientez une minute avant de réessayer." },
      { status: 429 }
    );
  }

  let code: unknown;
  try {
    ({ code } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "Saisissez un code." }, { status: 400 });
  }

  try {
    const result = await validatePromoCode(createAdminClient(), code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    const { promo, eligiblePlans } = result.value;
    if (!promo.stripe_promotion_code_id) {
      return NextResponse.json(
        { error: "Ce code n'est pas applicable au paiement en ligne." },
        { status: 422 }
      );
    }

    // Prix remisés par plan éligible (affichage — Stripe applique la réduction).
    const prices = PLANS.filter(
      (p) => p.monthlyPrice > 0 && eligiblePlans.includes(p.id as (typeof eligiblePlans)[number])
    ).map((p) => ({
      planId: p.id,
      original: p.monthlyPrice,
      discounted: applyPromoDiscount(p.monthlyPrice, promo.discount_type, promo.discount_value),
    }));

    return NextResponse.json({
      valid: true,
      code: promo.code,
      description: promo.description,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      eligiblePlans,
      prices,
    });
  } catch (e) {
    logger.error("[stripe/promo-preview]", e);
    return NextResponse.json({ error: "Vérification impossible. Réessayez." }, { status: 500 });
  }
}
