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

/**
 * `Secure` sur les cookies de session — posé en production uniquement.
 *
 * @supabase/ssr ne met AUCUN `secure` dans ses options par défaut (voir
 * `DEFAULT_COOKIE_OPTIONS` : path, sameSite, httpOnly, maxAge — et rien
 * d'autre). Les trois endroits qui écrivent le cookie d'authentification
 * — le client navigateur, le client serveur et le proxy — recopiaient donc
 * des options sans `Secure`, et le cookie de session partait sans ce
 * drapeau : vérifié en ligne, `sb-…-auth-token` était posé `SameSite=Lax`
 * mais SANS `Secure`.
 *
 * Conséquence : une requête en clair vers le domaine emporterait le jeton
 * de session. `Strict-Transport-Security` couvre déjà les visites suivant
 * la première, mais un cookie de session n'a aucune raison d'être
 * transportable en clair — le drapeau ferme le cas restant.
 *
 * En développement, `http://localhost` ne doit PAS le recevoir : un cookie
 * `Secure` y serait purement et simplement ignoré par le navigateur, et
 * plus personne ne pourrait se connecter en local.
 */
export const SECURE_COOKIES = process.env.NODE_ENV === "production";

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
