/**
 * Consentement aux cookies non essentiels — source de vérité unique.
 *
 * POURQUOI CE MODULE EXISTE
 * Jusqu'ici, `nireo_vid` (UUID de visiteur, 1 an) et `nireo_vst` (nombre de
 * visites + source d'acquisition, 1 an) étaient posés dès la PREMIÈRE requête,
 * sans choix possible — pendant que /cookies affirmait n'en déposer aucun.
 *
 * Ces deux cookies ne sont pas « strictement nécessaires » : ils servent à
 * mesurer, et surtout à PERSONNALISER (le moteur d'expérimentation choisit
 * quelle version de la vitrine vous voyez, et relie votre conversion à cette
 * version). La personnalisation de contenu sort de l'exemption CNIL réservée
 * à la mesure d'audience strictement limitée : un choix doit donc être offert
 * AVANT le dépôt. Même chose pour `nireo_ref`, qui attribue une commission à
 * un partenaire — une finalité marketing par définition.
 *
 * CE QUE CE MÉCANISME FAIT VRAIMENT
 * Le refus n'est pas décoratif : sans consentement, le proxy ne pose
 * simplement PAS ces cookies (voir src/proxy.ts). La vitrine sert alors sa
 * variante de référence — chemin déjà prévu par le moteur
 * (`resolve.ts` : `if (!profile.visitorId) return fallback`), donc aucune
 * page ne casse et aucune mesure faussée n'est enregistrée.
 *
 * LE COOKIE DE CHOIX LUI-MÊME
 * `nireo_consent` est strictement nécessaire au sens de la CNIL : il ne sert
 * qu'à mémoriser le choix exprimé, et sans lui la question reviendrait à
 * chaque page. Il est délibérément LISIBLE PAR LE JAVASCRIPT (pas HttpOnly) :
 * la bannière doit savoir si elle a déjà été traitée sans aller au serveur.
 * Il ne contient aucune donnée personnelle — deux valeurs possibles.
 */

export const CONSENT_COOKIE = "nireo_consent";

/** `all` = mesure et personnalisation acceptées ; `essential` = refusées. */
export type ConsentChoice = "all" | "essential";

/**
 * Six mois. La CNIL recommande de ne pas conserver le choix indéfiniment et
 * de reposer la question périodiquement ; six mois est la durée d'usage.
 * Elle s'applique AUX DEUX réponses : un refus doit être respecté au moins
 * aussi longtemps qu'une acceptation, sinon le refus n'en est pas un.
 */
export const CONSENT_MAX_AGE = 180 * 24 * 3600;

export function parseConsent(raw: string | null | undefined): ConsentChoice | null {
  if (raw === "all" || raw === "essential") return raw;
  return null;
}

/** true si le visiteur a explicitement accepté la mesure et la personnalisation. */
export function hasAnalyticsConsent(raw: string | null | undefined): boolean {
  return parseConsent(raw) === "all";
}
