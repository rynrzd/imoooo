"use client";

import * as React from "react";

/**
 * Media query réactive, sûre au rendu serveur.
 *
 * `useSyncExternalStore` retourne `false` côté serveur et au premier rendu
 * client : aucun écart d'hydratation possible. Utile pour NE PAS MONTER un
 * composant coûteux (un graphique, une carte) sur les écrans où il est de
 * toute façon masqué en CSS — `display: none` le laisserait se construire dans
 * un conteneur de taille nulle, ce qui n'apporte rien et bruite la console.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Le seuil de la sidebar : au-dessus, on est « au bureau ». */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
