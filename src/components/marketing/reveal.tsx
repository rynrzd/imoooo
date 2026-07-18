"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Apparition douce au défilement (fade + léger slide).
 * - Rendu serveur : contenu visible (SEO, sans JavaScript).
 * - Après montage : seuls les éléments encore sous le pli sont masqués
 *   puis révélés à l'intersection.
 * - `prefers-reduced-motion` : aucune animation.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Décalage en ms (cascade discrète). */
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Déjà à l'écran : ne rien masquer (évite tout flash au chargement).
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setHidden(true);
    const reveal = () => {
      setHidden(false);
      observer.disconnect();
      window.clearTimeout(fallback);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(element);
    // Filet de sécurité : quoi qu'il arrive (observer silencieux, onglet en
    // arrière-plan…), le contenu ne reste JAMAIS masqué.
    const fallback = window.setTimeout(reveal, 2500);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none",
        hidden ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100",
        className
      )}
    >
      {children}
    </div>
  );
}
