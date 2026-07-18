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

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
  email_not_confirmed: "Votre adresse e-mail n'est pas encore confirmée.",
  email_address_invalid:
    "Cette adresse e-mail n'est pas acceptée. Utilisez une adresse réelle.",
  email_address_not_authorized:
    "Cette adresse e-mail n'est pas autorisée pour le moment.",
  validation_failed: "Adresse e-mail invalide.",
  weak_password:
    "Mot de passe trop faible : 8 caractères minimum, évitez les mots de passe trop courants.",
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

const FALLBACKS = {
  signin: "Connexion impossible pour le moment. Réessayez.",
  signup: "Inscription impossible pour le moment. Réessayez.",
  reset: "Envoi du lien impossible pour le moment. Réessayez.",
  update: "Mise à jour impossible pour le moment. Réessayez.",
  resend: "Envoi de l'e-mail impossible pour le moment. Réessayez.",
} as const;

export type AuthErrorContext = keyof typeof FALLBACKS;

/** Message français pour une erreur Supabase Auth (jamais le message brut). */
export function authErrorMessage(
  error: AuthErrorLike,
  context: AuthErrorContext
): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  // Anciennes versions GoTrue sans error_code : repli sur le texte connu.
  const msg = error.message.toLowerCase();
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
