/**
 * Constantes partagées de l'assistant d'onboarding (serveur ET client).
 * Aucune dépendance UI : importable depuis une route API comme depuis un
 * composant client, pour garder une seule source de vérité.
 */

/** Nombre d'étapes du guide (doit correspondre au tableau `steps` du wizard). */
export const ONBOARDING_TOTAL_STEPS = 4;

/**
 * Version du guide. À incrémenter UNIQUEMENT lors d'une refonte majeure du
 * contenu pour le reproposer aux utilisateurs. Un simple redéploiement ne
 * doit jamais changer cette valeur (sinon le guide réapparaîtrait à tous).
 */
export const ONBOARDING_VERSION = 1;

/** Actions de persistance acceptées par POST /api/onboarding. */
export type OnboardingAction = "step" | "skip" | "complete";

export function isOnboardingAction(value: unknown): value is OnboardingAction {
  return value === "step" || value === "skip" || value === "complete";
}

/** Borne une étape reçue du client dans [0, ONBOARDING_TOTAL_STEPS]. */
export function clampOnboardingStep(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(n, 0), ONBOARDING_TOTAL_STEPS);
}
