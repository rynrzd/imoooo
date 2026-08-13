/**
 * TRADUCTION DES ERREURS — l'utilisateur ne voit jamais un message brut de
 * Supabase, de PostgREST ou du réseau.
 *
 * Chaque cas connu reçoit une phrase française qui dit CE QUI s'est passé et
 * CE QU'IL FAUT FAIRE. Les cas inconnus retombent sur une phrase neutre : mieux
 * vaut « Enregistrement impossible » que `duplicate key value violates unique
 * constraint "leases_property_id_key"`.
 */

/** Motifs reconnus dans les messages remontés par Supabase / PostgREST. */
const PATTERNS: { match: RegExp; message: string }[] = [
  {
    match: /Failed to fetch|NetworkError|network request failed/i,
    message:
      "Connexion interrompue. Vérifiez votre réseau : rien n'a été enregistré.",
  },
  {
    match: /JWT expired|session|not authenticated|invalid claim/i,
    message: "Votre session a expiré. Reconnectez-vous puis réessayez.",
  },
  {
    match: /row-level security|permission denied|insufficient privilege/i,
    message: "Vous n'avez pas accès à cet élément.",
  },
  {
    match: /duplicate key|already exists|unique constraint/i,
    message: "Cet élément existe déjà.",
  },
  {
    match: /violates foreign key|is not present in table/i,
    message:
      "L'élément lié est introuvable. Rechargez la page puis réessayez.",
  },
  {
    match: /violates check constraint|invalid input syntax|numeric field overflow/i,
    message: "Une valeur saisie n'est pas valide. Vérifiez le formulaire.",
  },
  {
    match: /not-null constraint/i,
    message: "Une information obligatoire manque.",
  },
  {
    match: /payload too large|exceeded the maximum allowed size/i,
    message: "Fichier trop volumineux : 20 Mo maximum.",
  },
  {
    match: /timeout|timed out|canceling statement/i,
    message: "L'opération a pris trop de temps. Réessayez dans un instant.",
  },
];

/**
 * Message français prêt à afficher.
 *
 * Les erreurs que l'application a elle-même écrites (quotas de plan, formats de
 * fichier, session expirée…) sont DÉJÀ en français et se reconnaissent à leur
 * ponctuation : elles passent telles quelles.
 */
export function toUserMessage(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!raw) return fallback;

  for (const { match, message } of PATTERNS) {
    if (match.test(raw)) return message;
  }

  // Message maison : rédigé en français, avec une majuscule et un point final.
  const isOurs = /^[A-ZÀ-Þ].*[.!?]$/.test(raw.trim()) && !/[{}[\]<>]/.test(raw);
  return isOurs ? raw : fallback;
}
