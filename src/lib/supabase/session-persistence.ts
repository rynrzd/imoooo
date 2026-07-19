/**
 * « Se souvenir de moi » — persistance de la session Supabase.
 *
 * @supabase/ssr stocke la session dans des cookies dont le `maxAge` est forcé
 * à 400 jours : impossible d'obtenir une session éphémère via ses options.
 * On contrôle donc nous-mêmes la durée du cookie de session Auth :
 * - préférence « rester connecté » (défaut) → cookie persistant (400 j) ;
 * - préférence décochée → cookie de SESSION (supprimé à la fermeture du
 *   navigateur), sans jamais stocker le mot de passe.
 *
 * La préférence vit dans un cookie first-party (`immopilot-remember`) afin que
 * le client navigateur ET le proxy serveur appliquent la même durée à chaque
 * écriture/rafraîchissement — sinon le proxy réécrirait un cookie persistant.
 */

export const REMEMBER_COOKIE = "immopilot-remember";

interface CookieLike {
  name: string;
  value: string;
}

/** Préférence lue depuis une liste de cookies (défaut : rester connecté). */
export function rememberFromCookies(cookies: readonly CookieLike[]): boolean {
  const found = cookies.find((c) => c.name === REMEMBER_COOKIE);
  return found ? found.value !== "0" : true;
}

/**
 * Options minimales portées par les cookies Supabase.
 * (sous-ensemble compatible NextResponse.cookies et document.cookie).
 */
export interface PersistenceOptions {
  maxAge?: number;
  expires?: Date | number;
  [key: string]: unknown;
}

/**
 * Ajuste la durée d'un cookie Auth selon la préférence.
 * - suppression (maxAge 0) : inchangée ;
 * - rester connecté : inchangée (persistante) ;
 * - session éphémère : retire maxAge/expires → cookie de session.
 */
export function adjustPersistence<T extends PersistenceOptions>(
  options: T,
  remember: boolean
): T {
  if (!options || options.maxAge === 0) return options;
  if (remember) return options;
  const next = { ...options };
  delete next.maxAge;
  delete next.expires;
  return next;
}
