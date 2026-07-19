/**
 * Intention d'achat Fondateur mémorisée dans le navigateur : posée quand un
 * visiteur crée son compte depuis la page /fondateur, consommée à la première
 * ouverture de l'application (après confirmation de l'e-mail) pour reprendre
 * automatiquement le tunnel de paiement sans re-choisir l'offre.
 * Le palier (299/499 €) n'est PAS stocké : il est toujours recalculé côté
 * serveur d'après les places réellement confirmées.
 */

const KEY = "immopilot:founder-intent";

export function setFounderIntent(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Stockage indisponible (navigation privée…) : l'utilisateur retrouvera
    // l'offre en haut de la page Abonnements — jamais bloquant.
  }
}

/** Lit ET efface l'intention (une seule reprise, jamais de boucle). */
export function consumeFounderIntent(): boolean {
  try {
    const present = window.localStorage.getItem(KEY) === "1";
    if (present) window.localStorage.removeItem(KEY);
    return present;
  } catch {
    return false;
  }
}
