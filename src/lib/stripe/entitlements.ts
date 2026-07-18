/**
 * Permissions dérivées du plan — fonctions PURES (client + serveur).
 * Côté client : informer avant d'agir. Côté serveur : la contrainte dure
 * vit en base (triggers enforce_*_limit) et dans les guards des routes.
 * Source de vérité des limites : src/config/plans.ts.
 */

import { getPlan, planHasFeature, type FeatureId } from "@/config/plans";

export interface EntitlementCheck {
  allowed: boolean;
  /** Message français prêt à afficher quand `allowed` est faux. */
  reason: string | null;
}

const OK: EntitlementCheck = { allowed: true, reason: null };

function upgradeHint(planId: string | null | undefined): string {
  const plan = getPlan(planId);
  if (plan.id === "free") return "Passez au plan Starter pour gérer jusqu'à 10 logements.";
  if (plan.id === "starter") return "Passez au plan Pro pour gérer jusqu'à 30 logements.";
  return "Passez au plan Business+ pour lever cette limite.";
}

function limitCheck(
  planId: string | null | undefined,
  max: number | null,
  currentCount: number,
  label: string
): EntitlementCheck {
  if (max === null || currentCount < max) return OK;
  const plan = getPlan(planId);
  return {
    allowed: false,
    reason: `Votre plan ${plan.name} permet ${max} ${label} maximum. ${upgradeHint(planId)}`,
  };
}

/** L'utilisateur peut-il ajouter un logement supplémentaire ? */
export function canCreateProperty(
  planId: string | null | undefined,
  currentCount: number
): EntitlementCheck {
  return limitCheck(
    planId,
    getPlan(planId).limits.maxProperties,
    currentCount,
    "logement(s)"
  );
}

/** L'utilisateur peut-il ajouter un locataire actif supplémentaire ? */
export function canCreateTenant(
  planId: string | null | undefined,
  currentActiveCount: number
): EntitlementCheck {
  return limitCheck(
    planId,
    getPlan(planId).limits.maxActiveTenants,
    currentActiveCount,
    "locataire(s) actif(s)"
  );
}

/** L'utilisateur peut-il ajouter un document ? */
export function canUploadDocument(
  planId: string | null | undefined,
  currentCount: number
): EntitlementCheck {
  return limitCheck(planId, getPlan(planId).limits.maxDocuments, currentCount, "documents");
}

/** L'utilisateur peut-il ajouter une photo ? */
export function canUploadPhoto(
  planId: string | null | undefined,
  currentCount: number
): EntitlementCheck {
  return limitCheck(planId, getPlan(planId).limits.maxPhotos, currentCount, "photos");
}

/** Le plan inclut-il la fonctionnalité ? (message prêt à afficher sinon) */
export function hasFeature(
  planId: string | null | undefined,
  feature: FeatureId
): EntitlementCheck {
  if (planHasFeature(planId, feature)) return OK;
  const plan = getPlan(planId);
  return {
    allowed: false,
    reason: `Cette fonctionnalité n'est pas incluse dans votre plan ${plan.name}. ${upgradeHint(planId)}`,
  };
}

/* Alias historiques (store) — mêmes fonctions. */
export const canAddProperty = canCreateProperty;
export const canAddActiveTenant = canCreateTenant;
