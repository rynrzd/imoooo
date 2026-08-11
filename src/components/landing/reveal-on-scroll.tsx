"use client";

import * as React from "react";

/**
 * Révélations au défilement de la landing — un seul observateur pour toute la
 * page, aucune dépendance, aucun état React.
 *
 * Principe : le HTML est rendu COMPLET et lisible côté serveur. Ce composant
 * se contente de poser `data-reveal="hidden"` (ou `data-draw` / `data-unmask`)
 * sur les éléments encore sous le pli, puis de le retirer quand ils arrivent à
 * l'écran. Conséquences :
 * - sans JavaScript, rien n'est jamais masqué ;
 * - avec « prefers-reduced-motion », le composant ne fait strictement rien ;
 * - chaque élément n'est animé qu'une fois, puis cesse d'être observé — aucune
 *   animation ne suit le défilement, aucune ne tourne en boucle.
 *
 * Marquage attendu dans le HTML (cf. globals.css) :
 * - `data-reveal` : fondu + montée de quelques pixels ;
 * - `data-draw`   : tracé progressif d'un trait SVG (`--nl-len` = longueur) ;
 * - `data-line`   : filet horizontal qui se déploie depuis son attache ;
 * - `data-unmask` : dévoilement d'un bloc par `clip-path`.
 */

/** Attribut porté par l'élément — sert de nom d'état à remettre à zéro. */
const KINDS = ["reveal", "draw", "line", "unmask"] as const;

const SELECTOR = KINDS.map((kind) => `[data-${kind}]`).join(", ");

export function RevealOnScroll() {
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
    if (elements.length === 0) return;

    /** Passe l'élément à l'état visible (l'état de repos du CSS). */
    const show = (el: Element) => {
      for (const kind of KINDS) {
        if (el.getAttribute(`data-${kind}`) === "hidden") el.setAttribute(`data-${kind}`, "");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          show(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    // Masquage APRÈS le premier rendu : ce qui est déjà à l'écran ne
    // disparaît jamais, même une frame.
    const hidden: HTMLElement[] = [];
    for (const el of elements) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.88) continue;
      for (const kind of KINDS) {
        if (el.hasAttribute(`data-${kind}`)) el.setAttribute(`data-${kind}`, "hidden");
      }
      hidden.push(el);
      observer.observe(el);
    }

    // Filet de sécurité : quoi qu'il arrive (observateur silencieux, onglet en
    // arrière-plan…), aucun contenu ne reste masqué.
    const fallback = window.setTimeout(() => hidden.forEach(show), 4000);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
      hidden.forEach(show);
    };
  }, []);

  return null;
}
