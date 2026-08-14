"use client";

import * as React from "react";

/**
 * Deux mouvements liés au geste du visiteur, et deux seulement.
 *
 * Règles communes :
 * - rien ne bouge si « prefers-reduced-motion » est demandé ;
 * - rien ne bouge sur les petits écrans (téléphones) : ce sont les appareils
 *   les moins puissants, et un mouvement lié au défilement y coûte cher pour
 *   un effet qu'on ne voit pas ;
 * - la seule propriété écrite est une variable CSS consommée par un
 *   `translate3d` : aucune lecture de mise en page dans la boucle, aucun
 *   décalage possible du contenu.
 */

function enabled(minWidth: number): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
    window.matchMedia(`(min-width: ${minWidth}px)`).matches
  );
}

/**
 * Parallaxe du hero — la photographie descend d'un dixième du défilement,
 * plafonnée pour ne jamais découvrir le bord de la section.
 */
export function HeroParallax({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !enabled(768)) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // Le hero fait au plus une hauteur d'écran : au-delà, plus rien à faire.
      const offset = Math.min(window.scrollY, window.innerHeight) * 0.1;
      node.style.setProperty("--nl-parallax", `${offset.toFixed(1)}px`);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      node.style.removeProperty("--nl-parallax");
    };
  }, []);

  return (
    <div ref={ref} className="nl-parallax absolute inset-0 -z-10">
      {children}
    </div>
  );
}

/** Amplitude maximale du micro-mouvement au pointeur, en pixels. */
const SHIFT = 4;

/**
 * Micro-parallaxe au pointeur — quatre pixels au maximum, sur ordinateur
 * uniquement (`hover: hover` et `pointer: fine`). Ce n'est pas un effet de
 * profondeur : juste assez pour que l'aperçu réagisse à la présence.
 */
export function PointerShift({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !enabled(1024)) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      frame = 0;
      node.style.setProperty("--nl-shift-x", `${x.toFixed(2)}px`);
      node.style.setProperty("--nl-shift-y", `${y.toFixed(2)}px`);
    };

    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      x = ((event.clientX - box.left) / box.width - 0.5) * 2 * SHIFT;
      y = ((event.clientY - box.top) / box.height - 0.5) * 2 * SHIFT;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      <div className="nl-shift">{children}</div>
    </div>
  );
}
