/**
 * Plans d'abonnement Nireo V1 — SOURCE DE VÉRITÉ UNIQUE.
 * Consommée par : landing page, page Tarifs, page Abonnement, Paramètres,
 * guards serveur, quotas, intégration Stripe.
 * Aucun prix, limite ou avantage ne doit être dupliqué ailleurs.
 *
 * ⚠️ Les limites (logements, locataires actifs, documents, photos) sont
 * AUSSI appliquées en base par des triggers (`enforce_*_limit`) : toute
 * modification ici doit être répercutée dans une migration.
 *
 * Règle commerciale : ne lister que des fonctions réelles. Les fonctions
 * en construction sont explicitement marquées « à venir ».
 */

export type PlanId = "free" | "starter" | "pro" | "business";
/** Plans achetables en ligne via Stripe Checkout (abonnement mensuel). */
export type PaidPlanId = "starter" | "pro" | "business";

/** Fonctionnalités activables par plan (guards `hasFeature`). */
export type FeatureId =
  | "manual_reminders" // relance manuelle de loyer par e-mail
  | "simple_exports" // exports JSON / CSV
  | "advanced_stats" // statistiques avancées
  | "monthly_reports" // rapport mensuel par e-mail
  | "auto_reminders" // relances automatiques planifiées
  | "advanced_notifications" // préférences fines par canal
  | "custom_email_templates" // message personnalisé dans les relances
  | "full_history" // historique complet
  | "patrimony_map" // carte interactive du patrimoine (Business+)
  | "command_center" // centre de pilotage avancé (Business+)
  | "early_access" // accès anticipé aux fonctions en test
  | "priority_support";

export interface PlanLimits {
  /** Nombre maximal de logements (null = illimité). */
  maxProperties: number | null;
  /** Locataires actifs simultanés (null = suit le nombre de logements). */
  maxActiveTenants: number | null;
  /** Nombre maximal de documents (null = pas de limite de nombre). */
  maxDocuments: number | null;
  /** Nombre maximal de photos (null = pas de limite de nombre). */
  maxPhotos: number | null;
  /** Stockage documents + photos, en Mo (politique d'usage raisonnable). */
  storageMb: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  /** Prix mensuel en euros TTC. */
  monthlyPrice: number;
  /** Prix annuel en euros (null : pas d'offre annuelle pour l'instant). */
  annualPrice: number | null;
  limits: PlanLimits;
  /** Fonctionnalités incluses (liste cumulative, explicite). */
  features: readonly FeatureId[];
  /** Points affichés sur les cartes tarifaires (fonctions réelles). */
  highlights: string[];
  /** Plan mis en avant. */
  popular?: boolean;
  /** Achetable aujourd'hui (false = masqué des tunnels d'achat). */
  available: boolean;
  /** Variable d'environnement portant le Stripe Price ID (null = gratuit). */
  stripePriceEnv: string | null;
  /** Ordre d'affichage croissant. */
  order: number;
  /** Libellé du bouton d'action. */
  cta: string;
  /** Destination du bouton : /abonnement (tunnel Stripe réel) pour les
   * plans payants, /inscription pour le plan Gratuit. */
  ctaHref: string;
}

const STARTER_FEATURES: readonly FeatureId[] = ["manual_reminders", "simple_exports"];
const PRO_FEATURES: readonly FeatureId[] = [
  ...STARTER_FEATURES,
  "advanced_stats",
  "monthly_reports",
  "auto_reminders",
  "advanced_notifications",
  "custom_email_templates",
  "full_history",
];
const BUSINESS_FEATURES: readonly FeatureId[] = [
  ...PRO_FEATURES,
  "patrimony_map",
  "command_center",
  "early_access",
  "priority_support",
];

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    monthlyPrice: 0,
    annualPrice: null,
    description: "Pour découvrir Nireo avec un premier bien.",
    highlights: [
      "1 logement, 1 locataire actif",
      "Loyers, dépenses et travaux",
      "Documents et photos (50 Mo)",
      "Dashboard et statistiques de base",
      "Support standard",
    ],
    limits: { maxProperties: 1, maxActiveTenants: 1, maxDocuments: 20, maxPhotos: 20, storageMb: 50 },
    features: [],
    available: true,
    stripePriceEnv: null,
    order: 1,
    cta: "Commencer gratuitement",
    ctaHref: "/inscription",
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9.99,
    annualPrice: null,
    description: "Pour les propriétaires jusqu'à 5 logements.",
    highlights: [
      "Jusqu'à 5 logements",
      "Locataires, baux et loyers complets",
      "Relances manuelles par e-mail",
      "Exports simples (JSON, CSV)",
      "Documents et photos (2 Go)",
      "Statistiques essentielles",
    ],
    limits: { maxProperties: 5, maxActiveTenants: null, maxDocuments: 500, maxPhotos: 500, storageMb: 2048 },
    features: STARTER_FEATURES,
    available: true,
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    order: 2,
    cta: "Choisir Starter",
    ctaHref: "/abonnement",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 14.99,
    annualPrice: null,
    description: "Pour les patrimoines en croissance, jusqu'à 12 logements.",
    highlights: [
      "Jusqu'à 12 logements",
      "Toutes les fonctions Starter",
      "Statistiques avancées",
      "Rapport mensuel par e-mail",
      "Relances automatiques de loyers",
      "Messages de relance personnalisables",
      "Historique complet",
      "Documents et photos (20 Go)",
    ],
    limits: { maxProperties: 12, maxActiveTenants: null, maxDocuments: 2000, maxPhotos: 2000, storageMb: 20480 },
    features: PRO_FEATURES,
    popular: true,
    available: true,
    stripePriceEnv: "STRIPE_PRICE_PRO",
    order: 3,
    cta: "Choisir Pro",
    ctaHref: "/abonnement",
  },
  {
    id: "business",
    name: "Business+",
    monthlyPrice: 23.99,
    annualPrice: null,
    description: "Pour les patrimoines établis, jusqu'à 25 logements.",
    highlights: [
      "Jusqu'à 25 logements",
      "Toutes les fonctions Pro",
      "Comptabilité avancée",
      "Carte interactive du patrimoine",
      "Centre de pilotage Premium",
      "Accès anticipé aux nouvelles fonctions",
      "Stockage 100 Go (usage raisonnable)",
      "Support prioritaire",
    ],
    limits: { maxProperties: 25, maxActiveTenants: null, maxDocuments: null, maxPhotos: null, storageMb: 102400 },
    features: BUSINESS_FEATURES,
    available: true,
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
    order: 4,
    cta: "Choisir Business+",
    ctaHref: "/abonnement",
  },
] as const;

/**
 * Avantages Business+ groupés par catégorie (carte Premium de la page Tarifs).
 * Même règle que `highlights` : uniquement des fonctions réelles, les fonctions
 * en construction restent marquées « à venir ».
 */
export interface BusinessCategory {
  id: "gestion" | "pilotage" | "exclusivites";
  label: string;
  items: string[];
}

export const BUSINESS_CATEGORIES: readonly BusinessCategory[] = [
  {
    id: "gestion",
    label: "Gestion",
    items: [
      "Jusqu'à 25 logements",
      "Comptabilité avancée",
      "Toutes les fonctions Pro",
      "Stockage 100 Go (usage raisonnable)",
    ],
  },
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      "Centre de pilotage Premium",
      "Carte interactive du patrimoine",
      "Statistiques avancées",
      "Rapport mensuel par e-mail",
    ],
  },
  {
    id: "exclusivites",
    label: "Exclusivités",
    items: [
      "Accès anticipé aux nouveautés",
      "Support prioritaire",
      "Toutes les futures fonctions Business+ incluses",
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Libellés dérivés — AUCUN prix ni quota ne doit être ressaisi ailleurs */
/* ------------------------------------------------------------------ */

/** « 9,99 » / « 0 » — sans symbole, formaté en français. */
export function formatPlanPrice(monthlyPrice: number): string {
  return monthlyPrice.toLocaleString("fr-FR", {
    minimumFractionDigits: monthlyPrice % 1 === 0 ? 0 : 2,
  });
}

/** « 50 Mo » / « 2 Go » / « 100 Go ». */
export function formatStorage(storageMb: number): string {
  return storageMb >= 1024 ? `${storageMb / 1024} Go` : `${storageMb} Mo`;
}

/** « 20 » / « Illimité » pour une limite de comptage. */
export function formatLimit(value: number | null): string {
  return value === null ? "Illimité" : String(value);
}

/** « 1 logement » / « jusqu'à 5 logements » / « logements illimités ». */
export function propertiesLabel(plan: Plan): string {
  const max = plan.limits.maxProperties;
  if (max === null) return "logements illimités";
  if (max === 1) return "1 logement";
  return `jusqu'à ${max} logements`;
}

/**
 * Phrase de quotas utilisée par la FAQ et les pages de contenu.
 * Générée depuis PLANS : elle ne peut pas diverger de la grille tarifaire.
 */
export function propertiesQuotaSentence(): string {
  return PLANS.map((plan) => `${plan.name} : ${propertiesLabel(plan)}`).join(" · ") + ".";
}

/** Plans réellement proposés (les plans retirés du catalogue disparaissent). */
export const AVAILABLE_PLANS: readonly Plan[] = PLANS.filter((p) => p.available);

/**
 * Offres schema.org d'un `SoftwareApplication`, dérivées de PLANS.
 * Aucun prix n'est ressaisi : modifier un tarif met à jour le JSON-LD.
 */
export function planOffersJsonLd(siteUrl: string) {
  return AVAILABLE_PLANS.map((plan) => ({
    "@type": "Offer" as const,
    name: `Nireo ${plan.name}`,
    description: plan.description,
    price: plan.monthlyPrice.toFixed(2),
    priceCurrency: "EUR",
    category: plan.monthlyPrice === 0 ? "free" : "subscription",
    url: `${siteUrl}/tarifs`,
    availability: "https://schema.org/InStock",
  }));
}

export const DEFAULT_PLAN_ID: PlanId = "free";

/** Ordre hiérarchique des plans (guards « plan minimum »). */
export const PLAN_ORDER: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, business: 3 };

export function isPlanId(value: string): value is PlanId {
  return PLANS.some((p) => p.id === value);
}

export function isPaidPlanId(value: string): value is PaidPlanId {
  return value === "starter" || value === "pro" || value === "business";
}

/**
 * Prix mensuel après réduction (fonction PURE, client + serveur).
 * AFFICHAGE uniquement : la réduction réelle est TOUJOURS appliquée par
 * Stripe via le promotion code (le montant n'est jamais fixé côté client).
 * `amount` est exprimé en euros (comme `discount_value` en base).
 */
export function applyPromoDiscount(
  monthlyPrice: number,
  discountType: "percent" | "amount",
  discountValue: number
): number {
  const raw =
    discountType === "percent"
      ? monthlyPrice * (1 - discountValue / 100)
      : monthlyPrice - discountValue;
  return Math.max(0, Math.round(raw * 100) / 100);
}

/**
 * Plan par identifiant — retombe sur Gratuit pour toute valeur inconnue.
 * `essentiel` (ancien nom du plan Starter) est accepté pour compatibilité
 * le temps que la migration de renommage soit exécutée.
 */
export function getPlan(id: string | null | undefined): Plan {
  if (id === "essentiel") id = "starter";
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** true si le plan inclut la fonctionnalité. */
export function planHasFeature(planId: string | null | undefined, feature: FeatureId): boolean {
  return getPlan(planId).features.includes(feature);
}

/* ------------------------------------------------------------------ */
/* Offre Fondateur — 100 places, accès Business+ à vie                 */
/* ------------------------------------------------------------------ */

export interface FounderTier {
  tier: 1 | 2;
  /** Première et dernière place du palier (incluses). */
  fromPlace: number;
  toPlace: number;
  /** Prix unique en euros. */
  price: number;
  stripePriceEnv: string;
}

export const FOUNDER_TIERS: readonly FounderTier[] = [
  { tier: 1, fromPlace: 1, toPlace: 50, price: 99.99, stripePriceEnv: "STRIPE_PRICE_FOUNDER_T1" },
  { tier: 2, fromPlace: 51, toPlace: 100, price: 119.99, stripePriceEnv: "STRIPE_PRICE_FOUNDER_T2" },
] as const;

export const FOUNDER_TOTAL_PLACES = 100;

/** Palier correspondant à un numéro de place (null si offre épuisée). */
export function founderTierForPlace(place: number): FounderTier | null {
  return FOUNDER_TIERS.find((t) => place >= t.fromPlace && place <= t.toPlace) ?? null;
}

/**
 * Périmètre commercial de l'offre (formulation contractuelle) :
 * accès à vie aux fonctionnalités Business+ développées par Nireo,
 * hors éventuels services tiers payants faisant l'objet d'une option distincte.
 */
export const FOUNDER_SCOPE_NOTICE =
  "Accès à vie aux fonctionnalités Business+ développées par Nireo, " +
  "hors éventuels services tiers payants faisant l'objet d'une option distincte.";
