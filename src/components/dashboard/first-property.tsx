"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { ONBOARDING_EVENT } from "@/lib/onboarding";
import { useAppStore } from "@/lib/store";

/**
 * Espace vide — l'écran d'accueil ne montre QUE ceci.
 *
 * Pas de graphique à zéro, pas de carte vide, pas de fausse donnée : tant
 * qu'aucun logement n'existe, aucun indicateur n'a de sens. Le tableau de bord
 * complet apparaît avec le premier bien.
 *
 * Le bouton ouvre le VRAI parcours de création (`/logements/nouveau`), le même
 * que le menu « Ajouter » et la page Logements — aucun formulaire dupliqué.
 */
export function FirstPropertyCta() {
  const { data, loading } = useAppStore();

  // Tant que les données chargent, on ne montre rien : un espace déjà rempli
  // ne doit jamais voir clignoter un « premier logement ».
  if (loading || data.properties.length > 0) return null;

  return (
    <section
      aria-label="Premier logement"
      className="animate-panel-in space-y-6 py-6"
    >
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"
      >
        <Building2 className="size-6" />
      </span>

      <div className="space-y-2">
        <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-foreground">
          Ajoutez votre premier logement.
        </h2>
        <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
          Nireo organisera ensuite sa location, ses documents et ses dépenses.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3">
        <Link
          href="/logements/nouveau"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.625rem] bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-95 sm:w-auto"
        >
          Ajouter un logement
          <ArrowRight className="size-4" aria-hidden />
        </Link>

        {/* Le chemin de retour vers le guide. Sans lui, quelqu'un qui l'a fermé
            n'aurait plus que Profil → Guide de démarrage pour le reprendre. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT))}
          className="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Se laisser guider pas à pas
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Plan Gratuit : 1 logement inclus, sans carte bancaire.
      </p>
    </section>
  );
}
