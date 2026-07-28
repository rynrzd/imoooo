"use client";

import * as React from "react";
import {
  Check,
  FileWarning,
  ImageOff,
  Layers,
  Receipt,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Avant / Après interactif — le visiteur bascule entre le désordre (fichiers
 * dispersés) et l'ordre Nireo. Transition douce, une seule signature visuelle.
 */

const CHAOS = [
  { label: "loyers_2026_v3.xlsx", icon: Receipt, top: "8%", left: "6%", rot: "-7deg" },
  { label: "IMG_2381.jpg", icon: ImageOff, top: "4%", left: "60%", rot: "6deg" },
  { label: "Relancer M. Durand", icon: StickyNote, top: "46%", left: "3%", rot: "-4deg" },
  { label: "bail(final)(2).pdf", icon: FileWarning, top: "40%", left: "56%", rot: "5deg" },
  { label: "Assurance ?", icon: FileWarning, top: "74%", left: "26%", rot: "-5deg" },
];

const ORDER = [
  "6 biens centralisés, à jour en permanence",
  "Loyers suivis, retards signalés automatiquement",
  "Documents classés par logement",
  "Résultat net et rendement calculés en continu",
];

export function BeforeAfter() {
  const [after, setAfter] = React.useState(false);

  return (
    <div>
      {/* Bascule */}
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1">
        <button
          onClick={() => setAfter(false)}
          aria-pressed={!after}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            !after ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sans Nireo
        </button>
        <button
          onClick={() => setAfter(true)}
          aria-pressed={after}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            after ? "nireo-glow bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Avec Nireo
        </button>
      </div>

      {/* Scène */}
      <div className="relative mt-8 min-h-[22rem] overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6">
        {after ? (
          <div key="after" className="animate-nireo-rise">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,var(--nireo-glow-a),transparent_60%)] opacity-20" />
            <div className="relative mx-auto max-w-xl">
              <div className="nireo-glass nireo-hairline rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles className="size-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Tout est réuni dans Nireo</p>
                    <p className="text-[11px] text-muted-foreground">Un seul espace, clair et à jour</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {ORDER.map((o, i) => (
                    <li key={o} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-3 py-2.5" style={{ animation: "nireo-rise 0.6s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${i * 90}ms` }}>
                      <span className="grid size-5 place-items-center rounded-full bg-primary/12 text-primary"><Check className="size-3" /></span>
                      <span className="text-sm text-foreground">{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div key="before" className="animate-nireo-rise">
            <div className="relative h-72 select-none" aria-hidden>
              {CHAOS.map((c) => (
                <div
                  key={c.label}
                  className="absolute flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 opacity-70 shadow-[0_18px_40px_-24px_oklch(0.28_0.03_235/0.35)] grayscale"
                  style={{ top: c.top, left: c.left, rotate: c.rot }}
                >
                  <c.icon className="size-4 text-muted-foreground/70" />
                  <span className="text-xs text-muted-foreground/80">{c.label}</span>
                </div>
              ))}
            </div>
            <div className="absolute right-5 bottom-5 flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-[11px] font-medium text-destructive">
              <X className="size-3.5" /> Informations dispersées
            </div>
            <div className="absolute bottom-5 left-5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Layers className="size-3.5" /> 5 outils différents
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
