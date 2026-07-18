"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DashboardPreview,
  DocumentsPreview,
  PropertyDossierPreview,
  StatsPreview,
  WorksPreview,
} from "./product-previews";

/**
 * Démonstration interactive : navigation par onglets + flèches sur les
 * aperçus réels de l'application (composés avec les vrais éléments d'UI —
 * aucune image à charger, rendu instantané et léger).
 */

const SLIDES: { id: string; label: string; description: string; render: () => React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Revenus, dépenses, résultat net et activité récente en un coup d'œil.",
    render: () => <DashboardPreview />,
  },
  {
    id: "logement",
    label: "Fiche logement",
    description: "Chaque bien porte son locataire, son bail, ses loyers et son historique.",
    render: () => <PropertyDossierPreview />,
  },
  {
    id: "documents",
    label: "Documents",
    description: "Baux, diagnostics et factures classés par logement, stockés en privé.",
    render: () => <DocumentsPreview />,
  },
  {
    id: "travaux",
    label: "Travaux",
    description: "Budgets, avancement et coût réel reliés automatiquement aux dépenses.",
    render: () => <WorksPreview />,
  },
  {
    id: "statistiques",
    label: "Statistiques",
    description: "Taux d'occupation, rendement et performance calculés sur vos vraies données.",
    render: () => <StatsPreview />,
  },
];

export function DemoShowcase() {
  const [index, setIndex] = React.useState(0);
  const current = SLIDES[index];

  const go = (next: number) =>
    setIndex((next + SLIDES.length) % SLIDES.length);

  return (
    <div className="space-y-5">
      {/* Navigation par onglets */}
      <div
        role="tablist"
        aria-label="Écrans de l'application"
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              i === index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {slide.label}
          </button>
        ))}
      </div>

      {/* Slide courante */}
      <div className="relative mx-auto max-w-3xl">
        <div key={current.id} className="animate-in fade-in duration-500 motion-reduce:animate-none">
          {current.render()}
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Écran précédent"
          className="absolute top-1/2 -left-3 -translate-y-1/2 rounded-full bg-background shadow-sm sm:-left-5"
          onClick={() => go(index - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Écran suivant"
          className="absolute top-1/2 -right-3 -translate-y-1/2 rounded-full bg-background shadow-sm sm:-right-5"
          onClick={() => go(index + 1)}
        >
          <ChevronRight />
        </Button>
      </div>

      <p className="mx-auto max-w-xl text-center text-sm text-muted-foreground">
        {current.description}
      </p>
    </div>
  );
}
