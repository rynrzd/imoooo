"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { isPaidPlanId, type PaidPlanId } from "@/config/plans";
import { getPriceIdForPlan, isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import type { ActionResult } from "../types";

/**
 * Server Actions — codes promo.
 * Stripe connecté : le coupon et le promotion code sont créés via l'API
 * Stripe CÔTÉ SERVEUR (la clé secrète ne quitte jamais le serveur), puis
 * référencés dans `promo_codes`. C'est Stripe qui applique la réduction
 * au paiement (le tunnel Checkout accepte déjà les codes).
 */

export interface PromoInput {
  code: string;
  description: string;
  discountType: "percent" | "amount";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
  appliesToPlans: string[];
  maxRedemptions: number | null;
  oncePerCustomer: boolean;
  startsAt: string | null;
  expiresAt: string | null;
}

function validate(input: PromoInput): string | null {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,50}$/.test(code)) {
    return "Code invalide : 2 à 50 caractères (lettres, chiffres, tirets).";
  }
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    return "La valeur de la réduction doit être positive.";
  }
  if (input.discountType === "percent" && input.discountValue > 100) {
    return "Un pourcentage ne peut pas dépasser 100.";
  }
  if (input.duration === "repeating" && (!input.durationMonths || input.durationMonths < 1)) {
    return "Indiquez le nombre de mois pour une réduction répétée.";
  }
  if (input.maxRedemptions !== null && input.maxRedemptions < 1) {
    return "Le nombre maximal d'utilisations doit être d'au moins 1.";
  }
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) {
    return "Date d'expiration invalide.";
  }
  if (input.startsAt && Number.isNaN(Date.parse(input.startsAt))) {
    return "Date de début invalide.";
  }
  return null;
}

export async function createPromoCode(input: PromoInput): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const invalid = validate(input);
    if (invalid) return { ok: false, error: invalid };
    const code = input.code.trim().toUpperCase();
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("promo_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (existing) return { ok: false, error: "Ce code existe déjà." };

    const plans = input.appliesToPlans.filter(isPaidPlanId);

    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;
    if (isStripeConfigured) {
      const stripe = getStripe();

      // Restriction par plan : le coupon Stripe cible les produits des prix.
      let appliesTo: { products: string[] } | undefined;
      if (plans.length > 0) {
        const products: string[] = [];
        for (const plan of plans as PaidPlanId[]) {
          const price = await stripe.prices.retrieve(getPriceIdForPlan(plan));
          const product =
            typeof price.product === "string" ? price.product : price.product?.id;
          if (product) products.push(product);
        }
        if (products.length > 0) appliesTo = { products };
      }

      const coupon = await stripe.coupons.create({
        name: code,
        ...(input.discountType === "percent"
          ? { percent_off: input.discountValue }
          : { amount_off: Math.round(input.discountValue * 100), currency: "eur" }),
        duration: input.duration,
        ...(input.duration === "repeating"
          ? { duration_in_months: input.durationMonths ?? 1 }
          : {}),
        ...(appliesTo ? { applies_to: appliesTo } : {}),
      });
      stripeCouponId = coupon.id;

      const promotionCode = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code,
        ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
        ...(input.expiresAt
          ? { expires_at: Math.floor(Date.parse(input.expiresAt) / 1000) }
          : {}),
        // « Une utilisation par client » : Stripe applique la restriction
        // « première transaction du client » (pas de cumul possible).
        ...(input.oncePerCustomer ? { restrictions: { first_time_transaction: true } } : {}),
      });
      stripePromotionCodeId = promotionCode.id;
    }

    const { error } = await admin.from("promo_codes").insert({
      code,
      description: input.description.trim(),
      discount_type: input.discountType,
      discount_value: input.discountValue,
      duration: input.duration,
      duration_months: input.duration === "repeating" ? input.durationMonths : null,
      applies_to_plans: plans,
      max_redemptions: input.maxRedemptions,
      once_per_customer: input.oncePerCustomer,
      starts_at: input.startsAt,
      expires_at: input.expiresAt,
      is_active: true,
      stripe_coupon_id: stripeCouponId,
      stripe_promotion_code_id: stripePromotionCodeId,
      created_by: ctx.admin.id,
    });
    if (error) throw new Error(error.message);

    await logAdminAction(ctx, {
      action: "promo.create",
      targetLabel: code,
      newValue: {
        code,
        type: input.discountType,
        value: input.discountValue,
        stripe: Boolean(stripeCouponId),
      },
    });
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: isStripeConfigured
        ? "Code promo créé (Stripe + registre)."
        : "Code créé dans le registre. Sans Stripe, aucune réduction n'est appliquée au paiement.",
    };
  } catch (e) {
    logger.error("admin/promos", e);
    await logAdminAction(ctx, {
      action: "promo.create",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Création impossible." };
  }
}

/** Active / désactive un code (répercuté sur Stripe si le code y existe). */
export async function setPromoCodeActive(id: string, active: boolean): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const admin = createAdminClient();
    const { data: promo, error: readError } = await admin
      .from("promo_codes")
      .select("code, is_active, stripe_promotion_code_id")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!promo) return { ok: false, error: "Code introuvable." };

    if (promo.stripe_promotion_code_id) {
      if (!isStripeConfigured) {
        return { ok: false, error: "Stripe n'est pas configuré : impossible de modifier ce code." };
      }
      await getStripe().promotionCodes.update(promo.stripe_promotion_code_id, { active });
    }

    const { error } = await admin.from("promo_codes").update({ is_active: active }).eq("id", id);
    if (error) throw new Error(error.message);

    await logAdminAction(ctx, {
      action: "promo.toggle",
      targetLabel: promo.code as string,
      oldValue: { active: promo.is_active },
      newValue: { active },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: active ? "Code activé." : "Code désactivé." };
  } catch (e) {
    logger.error("admin/promos", e);
    return { ok: false, error: e instanceof Error ? e.message : "Modification impossible." };
  }
}

/** Met à jour la description interne d'un code. */
export async function updatePromoDescription(
  id: string,
  description: string
): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction(["admin"]);
    const admin = createAdminClient();
    const { data: promo } = await admin
      .from("promo_codes")
      .select("code, description")
      .eq("id", id)
      .maybeSingle();
    if (!promo) return { ok: false, error: "Code introuvable." };
    const { error } = await admin
      .from("promo_codes")
      .update({ description: description.trim() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await logAdminAction(ctx, {
      action: "promo.update",
      targetLabel: promo.code as string,
      oldValue: { description: promo.description },
      newValue: { description: description.trim() },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Description mise à jour." };
  } catch (e) {
    logger.error("admin/promos", e);
    return { ok: false, error: e instanceof Error ? e.message : "Modification impossible." };
  }
}

/** Resynchronise les compteurs d'utilisation depuis Stripe. */
export async function syncPromoUsage(): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isStripeConfigured) return { ok: false, error: "Stripe n'est pas configuré." };
    const admin = createAdminClient();
    const { data: codes, error } = await admin
      .from("promo_codes")
      .select("id, stripe_promotion_code_id, times_redeemed")
      .not("stripe_promotion_code_id", "is", null)
      .limit(50);
    if (error) throw new Error(error.message);
    const stripe = getStripe();
    let updated = 0;
    for (const row of codes ?? []) {
      const promotionCode = await stripe.promotionCodes.retrieve(
        row.stripe_promotion_code_id as string
      );
      if (promotionCode.times_redeemed !== row.times_redeemed) {
        await admin
          .from("promo_codes")
          .update({ times_redeemed: promotionCode.times_redeemed })
          .eq("id", row.id);
        updated++;
      }
    }
    revalidatePath("/admin", "layout");
    return { ok: true, message: `Compteurs synchronisés (${updated} mis à jour).` };
  } catch (e) {
    logger.error("admin/promos", e);
    return { ok: false, error: e instanceof Error ? e.message : "Synchronisation impossible." };
  }
}
