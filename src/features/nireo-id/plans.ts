/**
 * Nireo ID — offres, limites et droits.
 *
 * SOURCE UNIQUE utilisée par : la vitrine /id, la page d'abonnement, les
 * quotas serveur, les contrôles de création et le tunnel Stripe. Les mêmes
 * plafonds sont répliqués dans `nid_plan_limits` (migration V2) : la base
 * revérifie toujours ce que l'interface annonce.
 *
 * Les abonnements Nireo ID et Nireo Immo sont INDÉPENDANTS : aucun droit
 * ne traverse d'un produit à l'autre, les Price IDs sont distincts.
 */

export const NID_PLAN_IDS = [
  "perso_gratuit",
  "perso_famille",
  "entreprise_starter",
  "entreprise_equipe",
  "atelier_contributeur",
  "atelier_pro",
] as const;

export type NidPlanId = (typeof NID_PLAN_IDS)[number];

export type NidWorkspaceKind = "personnel" | "entreprise" | "atelier";

export interface NidPlan {
  id: NidPlanId;
  kind: NidWorkspaceKind;
  label: string;
  /** Prix en centimes (0 = gratuit). */
  priceCents: number;
  period: "mois" | "an" | "gratuit";
  /** Plafond de téléphones actifs. `null` = pas de plafond. */
  maxAssets: number | null;
  /** Plafond de membres de l'espace. `null` = pas de plafond. */
  maxMembers: number | null;
  summary: string;
  features: string[];
  /** Variable d'environnement portant le Price ID Stripe (null = non vendu). */
  priceEnv: string | null;
}

export const NID_PLANS: Record<NidPlanId, NidPlan> = {
  perso_gratuit: {
    id: "perso_gratuit",
    kind: "personnel",
    label: "Personnel",
    priceCents: 0,
    period: "gratuit",
    maxAssets: 3,
    maxMembers: 1,
    summary: "Pour suivre vos propres téléphones.",
    features: [
      "Jusqu’à 3 téléphones actifs",
      "Factures et documents essentiels",
      "Bilans réguliers",
      "Réparations",
      "Partage et transfert",
    ],
    priceEnv: null,
  },
  perso_famille: {
    id: "perso_famille",
    kind: "personnel",
    label: "Famille",
    priceCents: 2900,
    period: "an",
    maxAssets: null,
    maxMembers: 6,
    summary: "Pour suivre les téléphones de toute la maison.",
    features: [
      "Téléphones illimités",
      "Espace familial",
      "Stockage supérieur",
      "Alertes avancées",
      "Partage familial",
    ],
    priceEnv: "NIREO_ID_STRIPE_PRICE_FAMILLE",
  },
  entreprise_starter: {
    id: "entreprise_starter",
    kind: "entreprise",
    label: "Entreprise Starter",
    priceCents: 1900,
    period: "mois",
    maxAssets: 25,
    maxMembers: 10,
    summary: "Pour une petite flotte de téléphones professionnels.",
    features: [
      "Jusqu’à 25 téléphones",
      "Gestion du parc",
      "Affectations",
      "Bilans mensuels",
      "Réparations",
      "Collaborateurs",
    ],
    priceEnv: "NIREO_ID_STRIPE_PRICE_ENTREPRISE_STARTER",
  },
  entreprise_equipe: {
    id: "entreprise_equipe",
    kind: "entreprise",
    label: "Entreprise Équipe",
    priceCents: 4900,
    period: "mois",
    maxAssets: 150,
    maxMembers: 50,
    summary: "Pour gérer un parc complet avec plusieurs responsables.",
    features: [
      "Jusqu’à 150 téléphones",
      "Imports CSV",
      "Campagnes de bilan",
      "Rapports",
      "Rôles avancés",
      "Exports",
    ],
    priceEnv: "NIREO_ID_STRIPE_PRICE_ENTREPRISE_EQUIPE",
  },
  atelier_contributeur: {
    id: "atelier_contributeur",
    kind: "atelier",
    label: "Atelier contributeur",
    priceCents: 0,
    period: "gratuit",
    maxAssets: 0,
    maxMembers: 3,
    summary: "Pour compléter l’historique d’un client, sans abonnement.",
    features: [
      "Répondre aux interventions reçues",
      "Compléter l’historique d’un client",
    ],
    priceEnv: null,
  },
  atelier_pro: {
    id: "atelier_pro",
    kind: "atelier",
    label: "Atelier Pro",
    priceCents: 2900,
    period: "mois",
    maxAssets: 0,
    maxMembers: 25,
    summary: "Pour organiser les interventions de l’atelier.",
    features: [
      "Tableau d’interventions",
      "Équipe",
      "Modèles",
      "Rappels",
      "Exports",
      "Historique clients autorisé",
    ],
    priceEnv: "NIREO_ID_STRIPE_PRICE_ATELIER_PRO",
  },
};

export const NID_PLAN_LIST: NidPlan[] = NID_PLAN_IDS.map((id) => NID_PLANS[id]);

export function nidPlan(planId: string | null | undefined): NidPlan {
  const id = (planId ?? "") as NidPlanId;
  return NID_PLANS[id] ?? NID_PLANS.perso_gratuit;
}

export function nidPlansForKind(kind: NidWorkspaceKind): NidPlan[] {
  return NID_PLAN_LIST.filter((plan) => plan.kind === kind);
}

/** Prix lisible : « Gratuit », « 29 € / an », « 19 € / mois ». */
export function formatNidPrice(plan: NidPlan): string {
  if (plan.priceCents === 0) return "Gratuit";
  const euros = (plan.priceCents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: plan.priceCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${euros} € / ${plan.period}`;
}

/** Plafond atteint ? Le serveur applique la même règle, et la base aussi. */
export function isAssetQuotaReached(plan: NidPlan, activeAssets: number): boolean {
  return plan.maxAssets !== null && activeAssets >= plan.maxAssets;
}

export function remainingAssets(plan: NidPlan, activeAssets: number): number | null {
  if (plan.maxAssets === null) return null;
  return Math.max(0, plan.maxAssets - activeAssets);
}

/**
 * Droits fonctionnels dérivés du plan — vérifiés CÔTÉ SERVEUR avant
 * chaque action payante (jamais seulement masqués dans l'interface).
 */
export type NidEntitlement =
  | "import_csv"
  | "campagnes"
  | "rapports"
  | "roles_avances"
  | "exports";

const ENTITLEMENTS: Record<NidPlanId, NidEntitlement[]> = {
  perso_gratuit: [],
  perso_famille: [],
  entreprise_starter: [],
  entreprise_equipe: ["import_csv", "campagnes", "rapports", "roles_avances", "exports"],
  atelier_contributeur: [],
  atelier_pro: ["exports", "rapports"],
};

export function planHasEntitlement(
  planId: string | null | undefined,
  entitlement: NidEntitlement
): boolean {
  return ENTITLEMENTS[nidPlan(planId).id].includes(entitlement);
}

export const ENTITLEMENT_LABELS: Record<NidEntitlement, string> = {
  import_csv: "Import CSV",
  campagnes: "Campagnes de bilan",
  rapports: "Rapports",
  roles_avances: "Rôles avancés",
  exports: "Exports",
};
