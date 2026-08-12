"use client";

import * as React from "react";
import { Building2, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyWizard } from "@/components/properties/property-wizard";
import { useAppStore } from "@/lib/store";

/**
 * Espace vide — l'écran d'accueil ne montre QUE ceci.
 *
 * Pas de graphique à zéro, pas de carte vide, pas de fausse donnée : tant
 * qu'aucun logement n'existe, aucun indicateur n'a de sens. Le tableau de bord
 * complet apparaît avec le premier bien.
 *
 * Aucun formulaire dupliqué : le bouton ouvre l'assistant de création réel
 * (`PropertyWizard`), le même que celui du menu « Ajouter », du guide et de la
 * page Logements.
 */
export function FirstPropertyCta() {
  const { data, loading } = useAppStore();
  const [open, setOpen] = React.useState(false);

  // Tant que les données chargent, on ne montre rien : un espace déjà rempli
  // ne doit jamais voir clignoter un « premier logement ».
  if (loading || data.properties.length > 0) return null;

  return (
    <section
      aria-label="Premier logement"
      className="animate-panel-in flex flex-col items-center gap-5 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center sm:py-12"
    >
      <div className="relative" aria-hidden>
        <span className="flex size-16 items-center justify-center rounded-2xl border border-border bg-background shadow-xs">
          <Building2 className="size-7 text-muted-foreground" />
        </span>
        <span className="absolute -right-3 -bottom-2 flex size-8 items-center justify-center rounded-xl border border-border bg-background shadow-xs">
          <Wallet className="size-3.5 text-muted-foreground" />
        </span>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">
          Ajoutez votre premier logement
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Nireo organisera ensuite vos loyers, vos documents et vos dépenses autour
          de ce bien.
        </p>
      </div>

      {/* Zone tactile confortable (44 px) : c'est l'unique action de l'écran. */}
      <Button size="lg" className="h-11 px-6 text-sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Ajouter un logement
      </Button>

      <p className="text-xs text-muted-foreground">
        Plan Gratuit : 1 logement inclus, sans carte bancaire.
      </p>

      {/* Le chemin de retour vers le guide. Sans lui, quelqu'un qui l'a fermé
          n'aurait plus que Paramètres → Aide pour le reprendre. */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("immopilot:onboarding"))}
        className="min-h-11 text-xs text-primary underline-offset-4 hover:underline"
      >
        Se laisser guider pas à pas
      </button>

      {/* Monté seulement à l'ouverture : aucun formulaire initialisé à vide
          en arrière-plan sur l'écran d'accueil. */}
      {open ? (
        <PropertyWizard
          showTrigger={false}
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
