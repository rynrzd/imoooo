"use client";

import * as React from "react";

/**
 * Un chiffre DÉJÀ ÉCRIT qui compte jusqu'à lui-même, une seule fois.
 *
 * Le composant ne connaît aucune valeur : il reçoit la chaîne finale telle
 * qu'elle est affichée (« 840 000 € », « 94 % »), en extrait le nombre, et
 * anime uniquement cette portion en conservant le séparateur, le préfixe et
 * le suffixe d'origine. Conséquences :
 *
 * - aucun chiffre n'est inventé ni reformaté — ce qui est rendu au premier
 *   affichage est EXACTEMENT la chaîne reçue, donc aucun risque d'écart
 *   d'hydratation entre le serveur et le navigateur (contrairement à un
 *   `toLocaleString` exécuté des deux côtés) ;
 * - sans JavaScript, en mouvement réduit ou si la chaîne ne contient pas de
 *   nombre entier, la valeur finale est simplement affichée ;
 * - l'animation ne part qu'à l'entrée dans le viewport, et ne rejoue jamais.
 */

/**
 * Premier nombre ENTIER de la chaîne, séparateurs de milliers compris :
 * espace ordinaire, espace insécable ou espace fine insécable — les trois
 * formes qu'un « 840 000 » peut prendre selon la source.
 */
const NUMBER = /\d[\d   ]*\d|\d/;

const DURATION = 1100;

/** Regroupe par milliers avec le séparateur trouvé dans la chaîne d'origine. */
function group(value: number, separator: string): string {
  const digits = String(Math.round(value));
  if (!separator) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

export function AnimatedFigure({ value }: { value: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [text, setText] = React.useState(value);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const match = NUMBER.exec(value);
    if (!match) return;
    const raw = match[0];
    const target = Number(raw.replace(/\D/g, ""));
    if (!Number.isFinite(target) || target <= 0) return;
    const separator = raw.replace(/\d/g, "").slice(0, 1);
    const before = value.slice(0, match.index);
    const after = value.slice(match.index + raw.length);

    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      // easeOutExpo — part vite, se pose en douceur.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setText(`${before}${group(target * eased, separator)}${after}`);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setText(value);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={ref}>{text}</span>;
}
