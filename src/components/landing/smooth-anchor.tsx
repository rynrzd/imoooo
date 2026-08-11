"use client";

import * as React from "react";

/**
 * Lien d'ancre qui descend en douceur vers sa cible.
 *
 * C'est un vrai `<a href="#…">` : sans JavaScript le saut fonctionne
 * normalement, et le lien reste copiable, ouvrable dans un onglet et
 * annoncé correctement. Le seul apport est le défilement fluide — désactivé
 * si le visiteur demande moins d'animations, et jamais appliqué au reste du
 * site (aucun `scroll-behavior` global n'est posé).
 *
 * Le focus est déplacé sur la section d'arrivée : la navigation au clavier
 * continue donc là où le regard atterrit.
 */
export function SmoothAnchor({
  href,
  children,
  className,
  ...rest
}: React.ComponentProps<"a"> & { href: string }) {
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Clic modifié (nouvel onglet, téléchargement…) : comportement natif.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const id = href.startsWith("#") ? href.slice(1) : href.split("#")[1];
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // L'URL reflète la position, comme un saut d'ancre natif.
    history.replaceState(null, "", href);
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  return (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  );
}
