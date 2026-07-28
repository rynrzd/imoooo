"use client";

import * as React from "react";

/**
 * Fine barre de progression de lecture, ancrée en haut de la vitrine.
 * Purement décorative (aria-hidden), sans coût perceptible (rAF + passive).
 */
export function ScrollProgress() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        className="h-full origin-left bg-gradient-to-r from-primary to-teal-500"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
