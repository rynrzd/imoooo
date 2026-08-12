/**
 * Traduction des erreurs Supabase Auth en messages français clairs.
 * Jamais de message technique brut, jamais de détail permettant
 * d'énumérer les comptes existants.
 */

interface AuthErrorLike {
  code?: string;
  message: string;
  status?: number;
}

/** Message neutre : ne révèle jamais si une adresse possède déjà un compte. */
export const NEUTRAL_SIGNUP_MESSAGE =
  "Si cette adresse peut être utilisée, vous recevrez un e-mail de confirmation.";

/** Le seul critère réellement exigé par la configuration : la longueur. */
export const PASSWORD_MIN_LENGTH = 8;

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed: "Votre adresse e-mail n'est pas encore confirmée.",
  email_address_invalid: "Saisissez une adresse e-mail valide.",
  email_address_not_authorized:
    "Cette adresse e-mail n'est pas autorisée pour le moment.",
  validation_failed: "Saisissez une adresse e-mail valide.",
  weak_password: `Mot de passe trop court : ${PASSWORD_MIN_LENGTH} caractères minimum.`,
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  user_already_exists: NEUTRAL_SIGNUP_MESSAGE,
  email_exists: NEUTRAL_SIGNUP_MESSAGE,
  signup_disabled: "Les inscriptions sont temporairement fermées.",
  over_email_send_rate_limit:
    "Trop d'e-mails envoyés récemment. Patientez quelques minutes avant de réessayer.",
  over_request_rate_limit:
    "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  otp_expired: "Ce lien est invalide ou a expiré.",
  otp_disabled: "Ce type de lien n'est plus accepté.",
  session_not_found: "Session expirée. Reconnectez-vous.",
  refresh_token_not_found: "Session expirée. Reconnectez-vous.",
  user_not_found: "Session expirée. Reconnectez-vous.",
  request_timeout: "Le serveur met trop de temps à répondre. Réessayez.",
};

const SMTP_FAILURE_MESSAGE =
  "L'e-mail de confirmation n'a pas pu être envoyé (service e-mail indisponible). " +
  "Réessayez plus tard ou contactez le support.";

/** Panne de réseau : le seul cas où l'on peut dire quoi faire précisément. */
export const NETWORK_MESSAGE =
  "Connexion impossible. Vérifiez votre réseau puis réessayez.";

/** Repli unique : jamais de code, jamais d'anglais, jamais de détail interne. */
const UNKNOWN_MESSAGE = "Une erreur est survenue. Réessayez dans quelques instants.";

const FALLBACKS = {
  signin: UNKNOWN_MESSAGE,
  signup: UNKNOWN_MESSAGE,
  reset: UNKNOWN_MESSAGE,
  update: UNKNOWN_MESSAGE,
  resend: UNKNOWN_MESSAGE,
} as const;

export type AuthErrorContext = keyof typeof FALLBACKS;

/** Message français pour une erreur Supabase Auth (jamais le message brut). */
export function authErrorMessage(
  error: AuthErrorLike,
  context: AuthErrorContext
): string {
  // Diagnostic développement uniquement : code + statut + message GoTrue
  // (jamais de token, mot de passe ou clé — GoTrue n'en renvoie pas ici).
  // Les propriétés d'une Error sont non-énumérables : on sérialise
  // explicitement, sinon le terminal n'affiche que « {} ».
  if (process.env.NODE_ENV === "development") {
    const e = error as AuthErrorLike & { name?: string; cause?: unknown };
    console.warn(
      `[auth:${context}]`,
      JSON.stringify(
        {
          name: e.name,
          message: e.message,
          code: e.code,
          status: e.status,
          cause: e.cause instanceof Error ? e.cause.message : e.cause,
          json: JSON.stringify(e, Object.getOwnPropertyNames(e)),
        },
        null,
        2
      )
    );
  }
  // Réseau coupé, requête avortée : GoTrue n'a jamais répondu.
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  const msg = error.message.toLowerCase();
  // GoTrue renvoie 500 unexpected_failure « Error sending … email » quand le
  // SMTP configuré (Resend…) refuse l'envoi : message dédié, pas le repli générique.
  if (msg.includes("error sending")) return SMTP_FAILURE_MESSAGE;
  // Anciennes versions GoTrue sans error_code : repli sur le texte connu.
  if (msg.includes("invalid login credentials")) return MESSAGES.invalid_credentials;
  if (msg.includes("email not confirmed")) return MESSAGES.email_not_confirmed;
  if (msg.includes("rate limit")) return MESSAGES.over_email_send_rate_limit;
  return FALLBACKS[context];
}

/** true si l'erreur signifie « e-mail non confirmé » (redirige vers la vérification). */
export function isEmailNotConfirmed(error: AuthErrorLike): boolean {
  return (
    error.code === "email_not_confirmed" ||
    error.message.toLowerCase().includes("email not confirmed")
  );
}

/**
 * true si la requête n'a jamais abouti (réseau, DNS, requête avortée).
 * `AuthRetryableFetchError` porte le statut 0 ; le repli sur le texte couvre
 * les navigateurs plus anciens.
 */
export function isNetworkError(error: AuthErrorLike & { name?: string }): boolean {
  if (error.status === 0) return true;
  if (error.name === "AuthRetryableFetchError") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed")
  );
}

/**
 * true quand Supabase dit EXPLICITEMENT que l'adresse a déjà un compte.
 *
 * Ce n'est le cas que si la confirmation d'e-mail est désactivée. Avec la
 * confirmation active — la configuration de Nireo — GoTrue reste
 * volontairement muet pour empêcher d'énumérer les comptes : on ne devine
 * rien, l'écran de vérification s'affiche comme pour une adresse inconnue.
 */
export function isExistingAccount(error: AuthErrorLike): boolean {
  return error.code === "user_already_exists" || error.code === "email_exists";
}
