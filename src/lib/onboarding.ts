/**
 * Constantes partagées de l'assistant d'onboarding (serveur ET client).
 * Aucune dépendance UI : importable depuis une route API comme depuis un
 * composant client, pour garder une seule source de vérité.
 */

/**
 * Nombre d'écrans du guide : l'accueil (index 0) puis les QUATRE étapes
 * (logement, location, bail, résumé). Doit correspondre aux index de
 * `components/onboarding/onboarding-flow.tsx`.
 */
export const ONBOARDING_TOTAL_STEPS = 5;

/**
 * Version du guide. À incrémenter UNIQUEMENT lors d'une refonte majeure du
 * contenu pour le reproposer aux utilisateurs. Un simple redéploiement ne
 * doit jamais changer cette valeur (sinon le guide réapparaîtrait à tous).
 *
 * v2 (12/08/2026) : l'ancien diaporama en quatre écrans de texte, doublé
 * d'une visite à bulles, est remplacé par un guide qui crée réellement le
 * premier logement, son bail et son document. Les comptes qui possèdent déjà
 * un logement ne le revoient pas : le guide se garde lui-même.
 */
export const ONBOARDING_VERSION = 2;

/**
 * Événement de relance du guide. Il était écrit en dur (« immopilot:onboarding »)
 * dans trois fichiers : une faute de frappe dans l'un d'eux et le bouton ne
 * faisait plus rien, sans la moindre erreur. Une constante, un seul nom.
 */
export const ONBOARDING_EVENT = "nireo:onboarding";

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
