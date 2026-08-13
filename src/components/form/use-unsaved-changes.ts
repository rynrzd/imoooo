"use client";

import * as React from "react";

/**
 * PRÉVENIR AVANT DE PERDRE DES DONNÉES.
 *
 * Deux protections complémentaires :
 *
 * 1. `beforeunload` — fermeture d'onglet, rechargement, retour navigateur vers
 *    un autre site. Le navigateur affiche sa propre boîte : on ne peut ni la
 *    styler ni en changer le texte, c'est la règle du web.
 * 2. `confirmLeave()` — quitter volontairement le parcours (bouton « Quitter »,
 *    flèche retour). Là, l'application pose sa propre question, en français.
 *
 * Le hook ne fait rien tant que `dirty` est faux : un formulaire vierge ne
 * doit jamais retenir l'utilisateur.
 */
export function useUnsavedChanges(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Requis par Chrome pour déclencher la boîte native.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /** true si l'on peut quitter (rien à perdre, ou l'utilisateur a confirmé). */
  return React.useCallback(
    (message = "Vos modifications ne seront pas enregistrées. Quitter quand même ?") =>
      !dirty || window.confirm(message),
    [dirty]
  );
}
