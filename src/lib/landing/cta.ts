/**
 * Appel à l'action principal — FORMULATION ET DESTINATION UNIQUES.
 *
 * Le hero, le lien qui suit l'aperçu produit, le bloc final et le menu mobile
 * doivent promettre exactement la même chose et ouvrir exactement la même
 * route. Ces deux constantes sont la seule source : le catalogue du moteur de
 * personnalisation les reprend pour la variante « visiteur » (`hero_cta`), les
 * composants pour le reste.
 *
 * Module volontairement minuscule : il est importé par un composant client
 * (le menu de la landing), qui n'a donc pas à embarquer tout le catalogue.
 *
 * Seule exception assumée : un visiteur DÉJÀ CONNECTÉ reçoit la variante
 * « membre » du catalogue (« Ouvrir mon tableau de bord » → « / »). Lui
 * proposer de créer un espace qu'il possède déjà n'aurait aucun sens.
 */

/** Le libellé, à la lettre près, de tous les appels à l'action principaux. */
export const PRIMARY_CTA_LABEL = "Créer mon espace gratuit";

/** La vraie route d'inscription du produit. */
export const SIGNUP_PATH = "/inscription";
