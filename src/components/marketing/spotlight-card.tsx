"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Carte de la vitrine : filet encre, papier clair, élévation discrète au
 * survol. La position du curseur reste suivie (`--spot-x` / `--spot-y`) car
 * elle ne coûte rien et sert de point d'accroche, mais plus aucun halo coloré
 * n'est peint : l'univers de la landing n'en admet aucun.
 */
export function SpotlightCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
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
        "group/spot relative overflow-hidden rounded-xl border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))]",
        "transition-[transform,border-color] duration-[var(--mo-component)] ease-[var(--mo-ease)] motion-reduce:transition-none",
        "hover:-translate-y-0.5 hover:border-[var(--nl-cobalt)]/40",
        className
      )}
      {...props}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
