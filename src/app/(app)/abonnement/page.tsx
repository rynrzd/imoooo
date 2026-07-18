import { SubscriptionPageClient } from "@/components/subscription/subscription-page";
import { isStripeConfigured } from "@/lib/stripe/config";

/**
 * Page Abonnement — wrapper serveur : `isStripeConfigured` est lu côté
 * serveur (la clé secrète n'atteint jamais le navigateur). Sans Stripe,
 * aucun bouton de paiement n'est affiché — jamais de paiement simulé.
 */
export default function SubscriptionPage() {
  return <SubscriptionPageClient stripeEnabled={isStripeConfigured} />;
}
