"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Carte « verre » premium avec halo lumineux qui suit le curseur.
 * Le halo est purement décoratif (pointer-events: none) et se désactive
 * naturellement au toucher (aucun mouvement de souris).
 */
export function SpotlightCard({
  children,
  className,
  glow = "var(--nireo-glow-a)",
  ...props
}: React.ComponentProps<"div"> & { glow?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn(
        "group/spot relative overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-sm transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_44px_-30px_oklch(0.28_0.03_235/0.3)]",
        className
      )}
      {...props}
    >
      {/* Halo curseur */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(240px circle at var(--spot-x, 50%) var(--spot-y, 0), color-mix(in oklch, ${glow}, transparent 78%), transparent 60%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
