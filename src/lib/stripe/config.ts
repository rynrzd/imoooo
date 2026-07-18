/**
 * Configuration Stripe — centralisée et validée.
 *
 * Variables attendues (Dashboard Stripe → Developers → API keys) :
 * - STRIPE_SECRET_KEY                      clé secrète (sk_test_… / sk_live_…), serveur uniquement
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY     clé publiable (pk_test_… / pk_live_…)
 * - STRIPE_WEBHOOK_SECRET                  secret de signature du webhook (whsec_…)
 * - STRIPE_PRICE_ESSENTIEL / STRIPE_PRICE_PRO
 *                                          identifiants de prix (price_…) des produits Stripe
 *
 * Tant que ces variables ne sont pas renseignées, `isStripeConfigured` est
 * faux : les routes API répondent 503 avec un message clair et l'interface
 * affiche « paiement bientôt disponible ». Aucune clé n'est inventée,
 * aucune valeur n'est loguée.
 */

import type { PaidPlanId } from "@/config/plans";

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function fail(message: string): never {
  throw new Error(`Configuration Stripe invalide — ${message}`);
}

/** Vraie clé secrète attendue côté serveur (jamais une clé publiable). */
function validateSecretKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("pk_")) {
    fail(
      "STRIPE_SECRET_KEY contient une clé publiable (pk_…). " +
        "Renseignez la clé secrète (sk_test_… ou sk_live_…)."
    );
  }
  if (!trimmed.startsWith("sk_") && !trimmed.startsWith("rk_")) {
    fail("STRIPE_SECRET_KEY doit commencer par sk_ (ou rk_ pour une clé restreinte).");
  }
  return trimmed;
}

/** La clé publiable est la seule exposable au navigateur. */
function validatePublishableKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("sk_") || trimmed.startsWith("rk_") || trimmed.startsWith("whsec_")) {
    fail(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY contient une clé secrète. " +
        "Les clés sk_/rk_/whsec_ ne doivent JAMAIS être exposées au navigateur : " +
        "utilisez la clé publiable (pk_test_… ou pk_live_…)."
    );
  }
  if (!trimmed.startsWith("pk_")) {
    fail("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY doit commencer par pk_.");
  }
  return trimmed;
}

/**
 * Stripe est « configuré » quand la clé secrète est présente côté serveur.
 * (La clé publiable n'est requise que si un composant client utilise
 * Stripe.js — le tunnel Checkout actuel n'en a pas besoin.)
 */
export const isStripeConfigured =
  typeof SECRET_KEY === "string" && SECRET_KEY.trim().length > 0;

/** Clé secrète validée. À n'appeler que côté serveur, si `isStripeConfigured`. */
export function getStripeSecretKey(): string {
  if (!SECRET_KEY) {
    fail(
      "STRIPE_SECRET_KEY est absente. Renseignez-la dans .env.local " +
        "(voir .env.example) une fois votre compte Stripe créé."
    );
  }
  return validateSecretKey(SECRET_KEY);
}

/** Clé publiable validée (null tant qu'elle n'est pas renseignée). */
export const stripePublishableKey = PUBLISHABLE_KEY
  ? validatePublishableKey(PUBLISHABLE_KEY)
  : null;

/** Secret de signature du webhook. Requis uniquement par la route webhook. */
export function getStripeWebhookSecret(): string {
  const trimmed = WEBHOOK_SECRET?.trim();
  if (!trimmed) {
    fail(
      "STRIPE_WEBHOOK_SECRET est absent. Créez le webhook dans le Dashboard " +
        "Stripe (Developers → Webhooks) puis copiez son secret (whsec_…)."
    );
  }
  if (!trimmed.startsWith("whsec_")) {
    fail("STRIPE_WEBHOOK_SECRET doit commencer par whsec_.");
  }
  return trimmed;
}

/**
 * Variables d'environnement portant les identifiants de prix Stripe
 * (abonnements mensuels). Source des plans : src/config/plans.ts.
 */
const PRICE_ENV_BY_PLAN: Record<PaidPlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  business: "STRIPE_PRICE_BUSINESS",
};

/**
 * Prix unique Fondateur (paiement one-shot) par palier.
 * Requis uniquement quand l'offre Fondateur est vendue via Stripe.
 */
export function getFounderPriceId(tier: 1 | 2): string {
  const envVar = tier === 1 ? "STRIPE_PRICE_FOUNDER_T1" : "STRIPE_PRICE_FOUNDER_T2";
  const value = process.env[envVar]?.trim();
  if (!value) {
    fail(
      `${envVar} est absente. Créez le produit Fondateur (paiement unique) ` +
        "dans Stripe puis renseignez son identifiant de prix (price_…)."
    );
  }
  return value;
}

/**
 * Identifiant de prix Stripe (price_…) d'un plan payant.
 * Serveur uniquement (création des sessions Checkout).
 */
export function getPriceIdForPlan(plan: PaidPlanId): string {
  const envVar = PRICE_ENV_BY_PLAN[plan];
  const value = process.env[envVar]?.trim();
  if (!value) {
    fail(
      `${envVar} est absente. Créez le produit correspondant dans Stripe ` +
        "(Products → Add product) puis renseignez son identifiant de prix (price_…)."
    );
  }
  return value;
}

/** Plan correspondant à un identifiant de prix Stripe (webhook). */
export function planFromPriceId(priceId: string): PaidPlanId | null {
  for (const plan of Object.keys(PRICE_ENV_BY_PLAN) as PaidPlanId[]) {
    if (process.env[PRICE_ENV_BY_PLAN[plan]]?.trim() === priceId) return plan;
  }
  return null;
}
