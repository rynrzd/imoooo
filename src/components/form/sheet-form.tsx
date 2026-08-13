"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * ACTION RAPIDE — feuille montante focalisée.
 *
 * Pour les gestes courts et fréquents (encaisser un loyer, ajouter une
 * dépense) : quelques champs, une action, et on repart. C'est l'inverse d'un
 * parcours long — aucune étape, aucune progression, aucun plein écran.
 *
 * Elle réserve la zone gestuelle iPhone et ne dépasse jamais 88 % de la
 * hauteur visible : le contenu défile à l'intérieur, la page ne bouge pas.
 */
export function SheetForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Action principale (et éventuel lien secondaire). */
  actions: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="nireo-form max-h-[88svh] gap-0 rounded-t-2xl bg-background p-0"
      >
        {/* Poignée : dit sans mot que la feuille se referme vers le bas. */}
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-border" />
        </div>

        <div className="px-5 pt-2 pb-4">
          <SheetTitle className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </SheetTitle>
          {description ? (
            <p className="pt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {children}
        </div>

        <div
          className="shrink-0 space-y-2 border-t border-border px-5 pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {actions}
        </div>
      </SheetContent>
    </Sheet>
  );
}
