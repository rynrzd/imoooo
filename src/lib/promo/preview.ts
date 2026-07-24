import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaidPlanId, type PaidPlanId } from "@/config/plans";

/**
 * Validation des codes promo — SERVEUR uniquement (la table `promo_codes`
 * est invisible aux clients : RLS révoquée). Utilisée par l'aperçu de prix
 * ET par la création de la session Checkout : le même code est revalidé au
 * moment du paiement, jamais fixé par le navigateur.
 */

export interface PromoRecord {
  id: string;
  code: string;
  description: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  applies_to_plans: string[];
  max_redemptions: number | null;
  times_redeemed: number;
  once_per_customer: boolean;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  stripe_promotion_code_id: string | null;
}

export interface PromoValidation {
  promo: PromoRecord;
  /** Plans payants éligibles (applies_to_plans vide = tous les plans payants). */
  eligiblePlans: PaidPlanId[];
}

export type PromoResult =
  | { ok: true; value: PromoValidation }
  | { ok: false; error: string };

const ALL_PAID: readonly PaidPlanId[] = ["starter", "pro", "business"];

const PROMO_COLUMNS =
  "id, code, description, discount_type, discount_value, applies_to_plans, " +
  "max_redemptions, times_redeemed, once_per_customer, starts_at, expires_at, " +
  "is_active, stripe_promotion_code_id";

/**
 * Valide un code promo. `admin` DOIT être le client service_role (la RLS
 * masque la table). Si `plan` est fourni, l'éligibilité au plan est vérifiée.
 */
export async function validatePromoCode(
  admin: SupabaseClient,
  rawCode: string,
  plan?: string
): Promise<PromoResult> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,50}$/.test(code)) {
    return { ok: false, error: "Code promo invalide." };
  }

  const { data, error } = await admin
    .from("promo_codes")
    .select(PROMO_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  if (error) return { ok: false, error: "Vérification impossible. Réessayez." };
  if (!data) return { ok: false, error: "Ce code promo n'existe pas." };

  const promo = data as unknown as PromoRecord;
  if (!promo.is_active) return { ok: false, error: "Ce code promo n'est plus actif." };

  const now = Date.now();
  if (promo.starts_at && Date.parse(promo.starts_at) > now) {
    return { ok: false, error: "Ce code promo n'est pas encore actif." };
  }
  if (promo.expires_at && Date.parse(promo.expires_at) < now) {
    return { ok: false, error: "Ce code promo a expiré." };
  }
  if (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions) {
    return { ok: false, error: "Ce code promo a atteint sa limite d'utilisation." };
  }

  const eligiblePlans =
    promo.applies_to_plans.length > 0
      ? (promo.applies_to_plans.filter(isPaidPlanId) as PaidPlanId[])
      : [...ALL_PAID];
  if (eligiblePlans.length === 0) {
    return { ok: false, error: "Ce code n'est associé à aucun plan valide." };
  }

  if (plan !== undefined) {
    if (!isPaidPlanId(plan)) return { ok: false, error: "Plan invalide." };
    if (!eligiblePlans.includes(plan)) {
      return { ok: false, error: "Ce code ne s'applique pas à ce plan." };
    }
  }

  return { ok: true, value: { promo, eligiblePlans } };
}
