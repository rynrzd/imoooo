import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Statistiques des codes promo — SERVEUR (admin, clé secrète).
 * Sources réelles : `promo_codes` (compteurs) + `promo_code_redemptions`
 * (montants encaissés et réductions exactes fournies par Stripe).
 */

export interface PromoStats {
  /** Nombre total de codes créés. */
  totalCodes: number;
  /** Codes actuellement actifs. */
  activeCodes: number;
  /** Nombre d'utilisations cumulées (somme des times_redeemed). */
  totalRedemptions: number;
  /** Chiffre d'affaires encaissé sur les commandes ayant utilisé un code (centimes). */
  revenueCents: number;
  /** Montant total des réductions accordées (centimes, exact via Stripe). */
  discountCents: number;
  /** Code le plus utilisé (null si aucune utilisation). */
  topCode: { code: string; times: number } | null;
  /**
   * Taux d'utilisation des codes plafonnés (utilisations / plafond).
   * null si aucun code n'a de nombre maximal d'utilisations.
   */
  usageRate: number | null;
}

interface CodeRow {
  code: string;
  is_active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
}

interface RedemptionRow {
  amount_total_cents: number | null;
  discount_cents: number | null;
}

export async function getPromoStats(): Promise<PromoStats> {
  const admin = createAdminClient();

  const [codesRes, redemptionsRes] = await Promise.all([
    admin.from("promo_codes").select("code, is_active, times_redeemed, max_redemptions"),
    admin.from("promo_code_redemptions").select("amount_total_cents, discount_cents"),
  ]);
  if (codesRes.error) throw new Error(codesRes.error.message);
  if (redemptionsRes.error) throw new Error(redemptionsRes.error.message);

  const codes = (codesRes.data ?? []) as CodeRow[];
  const redemptions = (redemptionsRes.data ?? []) as RedemptionRow[];

  let totalRedemptions = 0;
  let cappedUses = 0;
  let cappedMax = 0;
  let topCode: PromoStats["topCode"] = null;
  for (const c of codes) {
    const times = c.times_redeemed ?? 0;
    totalRedemptions += times;
    if (c.max_redemptions !== null) {
      cappedUses += times;
      cappedMax += c.max_redemptions;
    }
    if (times > 0 && (topCode === null || times > topCode.times)) {
      topCode = { code: c.code, times };
    }
  }

  let revenueCents = 0;
  let discountCents = 0;
  for (const r of redemptions) {
    revenueCents += r.amount_total_cents ?? 0;
    discountCents += r.discount_cents ?? 0;
  }

  return {
    totalCodes: codes.length,
    activeCodes: codes.filter((c) => c.is_active).length,
    totalRedemptions,
    revenueCents,
    discountCents,
    topCode,
    usageRate: cappedMax > 0 ? cappedUses / cappedMax : null,
  };
}
