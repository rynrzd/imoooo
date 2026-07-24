import { SubscriptionPageClient } from "@/components/subscription/subscription-page";
import { getPublicSiteSettings } from "@/lib/admin/settings";
import { isStripeConfigured } from "@/lib/stripe/config";

/**
 * Page Abonnement — wrapper serveur : `isStripeConfigured` est lu côté
 * serveur (la clé secrète n'atteint jamais le navigateur). Sans Stripe,
 * aucun bouton de paiement n'est affiché — jamais de paiement simulé.
 * Le bloc marketing (P6) est lu côté serveur et transmis pour affichage.
 */
export default async function SubscriptionPage() {
  const { marketing_promo } = await getPublicSiteSettings();
  return <SubscriptionPageClient stripeEnabled={isStripeConfigured} promo={marketing_promo} />;
}
