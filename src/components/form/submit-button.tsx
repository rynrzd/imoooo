"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Deux clics plus rapprochés que ça sur un envoi sont le même geste. */
const BURST_MS = 500;

/**
 * Action principale d'un formulaire — dominante, pleine largeur, 48 px.
 *
 * ── DOUBLE CLIC ──────────────────────────────────────────────────────────
 * `disabled={pending}` NE SUFFIT PAS, contrairement à ce que ce composant
 * affirmait jusqu'ici. `setPending(true)` programme un rendu : il ne désactive
 * pas le bouton dans le tick courant. Trois clics rapides partent donc tous
 * les trois, et chaque gestionnaire lit encore `pending === false`.
 *
 * Constaté en pilotant un vrai navigateur sur la création d'un logement :
 * DEUX logements créés, et le quota du plan Gratuit (un seul logement)
 * franchi par un simple double clic.
 *
 * D'où ce verrou de temps, tenu dans une référence — donc lu et écrit
 * immédiatement, sans attendre de rendu. Il n'empêche que la RAFALE : un
 * nouveau clic délibéré (après avoir corrigé un champ, par exemple) passe
 * normalement, puisqu'il arrive bien au-delà d'un demi-tiers de seconde.
 *
 * Les appelants gardent leur propre garde-fou : celui-ci est une ceinture
 * de plus, posée une fois pour les cinquante formulaires du produit.
 *
 * Les trois états restent visibles : au repos, pendant l'envoi, après succès.
 */
export function SubmitButton({
  children,
  pending = false,
  done = false,
  pendingLabel = "Enregistrement…",
  doneLabel,
  disabled,
  type = "submit",
  onClick,
  className,
}: {
  children: React.ReactNode;
  pending?: boolean;
  /** Succès confirmé (affiché brièvement avant la navigation). */
  done?: boolean;
  pendingLabel?: string;
  doneLabel?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
}) {
  const lastAccepted = React.useRef(0);
  const guarded = (event: React.MouseEvent<HTMLButtonElement>) => {
    const now = Date.now();
    if (now - lastAccepted.current < BURST_MS) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    lastAccepted.current = now;
    onClick?.();
  };

  return (
    <button
      type={type}
      onClick={guarded}
      disabled={pending || done || disabled}
      aria-busy={pending || undefined}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.625rem] bg-primary px-4 text-[0.95rem] font-semibold text-primary-foreground",
        "transition-[opacity,transform] duration-200 outline-none",
        "hover:opacity-95 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:translate-y-px disabled:opacity-60 disabled:active:translate-y-0",
        className
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : done ? (
        <>
          <Check className="size-4" aria-hidden />
          {doneLabel ?? "Enregistré"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
