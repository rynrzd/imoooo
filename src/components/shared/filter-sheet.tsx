"use client";

import * as React from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Filtres secondaires — une feuille qui monte du bas.
 *
 * Les écrans de liste alignaient jusqu'à cinq `Select` en travers de la page :
 * illisible sous 400 px, et cela repoussait la liste sous la ligne de
 * flottaison. Ici l'écran ne montre qu'un bouton discret (avec le nombre de
 * filtres actifs), et le choix se fait dans une feuille au pouce, en options
 * de 44 px.
 *
 * Le composant ne détient aucun état : chaque écran reste maître de ses
 * filtres, ce qui évite toute divergence avec le calcul de sa liste.
 */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

export function FilterSheet({
  groups,
  activeCount,
  onReset,
  label = "Filtrer",
}: {
  groups: FilterGroup[];
  /** Nombre de filtres non neutres — affiché en pastille. */
  activeCount: number;
  onReset: () => void;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="h-9"
      >
        <SlidersHorizontal data-icon="inline-start" />
        {label}
        {activeCount > 0 ? (
          <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>

          <div
            className="space-y-5 px-4 py-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                <ul className="overflow-hidden rounded-lg border border-border">
                  {group.options.map((option) => {
                    const active = option.value === group.value;
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          onClick={() => group.onChange(option.value)}
                          aria-pressed={active}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-between gap-3 border-b border-border px-3 text-left text-sm last:border-b-0 transition-colors duration-200",
                            active
                              ? "bg-primary/5 font-medium text-foreground"
                              : "text-muted-foreground hover:bg-accent/60"
                          )}
                        >
                          <span className="truncate">{option.label}</span>
                          {active ? (
                            <Check className="size-4 shrink-0 text-primary" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                disabled={activeCount === 0}
              >
                Tout effacer
              </Button>
              <Button className="h-11 flex-1" onClick={() => setOpen(false)}>
                Voir les résultats
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
