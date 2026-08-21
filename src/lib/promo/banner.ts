import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { validatePromoCode } from "./preview";
import type { MarketingPromo } from "@/lib/admin/settings";

/**
 * Garde-fou d'affichage du bloc promotionnel — SERVEUR uniquement.
 *
 * Le bloc marketing est saisi librement dans /admin/parametres : titre,
 * message, et un code promo. Rien ne garantissait que ce code EXISTE
 * réellement. Le cas s'est produit : la base annonce « BIENVIENUE20 »
 * (faute de frappe) alors que la table `promo_codes` est vide — tout client
 * qui l'aurait saisi se serait vu refuser la réduction au paiement.
 *
 * Un code promotionnel affiché est une promesse commerciale. On ne l'affiche
 * donc que s'il est réellement utilisable : existant, actif, dans sa période
 * de validité, sous sa limite d'utilisation, et relié à un promotion code
 * Stripe — exactement les conditions que `validatePromoCode` vérifie déjà au
 * moment du paiement. La même règle décide de l'affichage et de
 * l'encaissement : il devient impossible qu'ils divergent.
 *
 * Le reste du bloc (titre, message) est conservé : une annonce sans code
 * reste une annonce valable. Seul le code disparaît.
 */
export async function withVerifiedPromoCode(
  promo: MarketingPromo | null | undefined
): Promise<MarketingPromo | null> {
  if (!promo || !promo.enabled) return promo ?? null;

  const code = promo.code?.trim();
  if (!code) return promo;

  // Sans clé serveur, impossible de vérifier : on retire le code plutôt que
  // d'annoncer une réduction dont on ne sait rien.
  if (!isAdminConfigured) return { ...promo, code: "" };

  try {
    const result = await validatePromoCode(createAdminClient(), code);
    if (result.ok && result.value.promo.stripe_promotion_code_id) return promo;

    logger.warn(
      "promo/banner",
      `Code « ${code} » annoncé sur le site mais inutilisable au paiement : ` +
        (result.ok ? "aucun promotion code Stripe associé." : result.error) +
        " Le code n'est pas affiché."
    );
    return { ...promo, code: "" };
  } catch (e) {
    logger.error("promo/banner", e);
    return { ...promo, code: "" };
  }
}
