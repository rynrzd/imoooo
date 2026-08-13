"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NireoMark } from "@/components/marketing/nireo-logo";
import { cn } from "@/lib/utils";

/**
 * COQUILLE DES PARCOURS LONGS — plein écran au doigt, page centrée au bureau.
 *
 * Elle remplace les modales sombres compressées : sur téléphone un formulaire
 * de création occupe l'écran entier (rien ne dépasse, rien ne défile derrière),
 * au-dessus de 768 px il devient une colonne confortable posée sur le fond
 * blanc cassé. Aucun grand cadre autour : c'est le fond de page qui porte le
 * formulaire, exactement comme sur la maquette.
 *
 * La barre d'actions est FIXE en bas et réserve la zone gestuelle iPhone ; le
 * corps réserve sa hauteur (`--form-actions-h`), donc le dernier champ reste
 * atteignable, clavier ouvert compris.
 */

/* ------------------------------------------------------------------ */
/*  Coquille                                                          */
/* ------------------------------------------------------------------ */

/** Abonnement inerte : `useSyncExternalStore` ne sert ici qu'à distinguer
 *  serveur et client, sans effet ni rendu supplémentaire. */
const noSubscribe = () => () => {};

export function FormShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // PORTAIL OBLIGATOIRE, et pas par élégance : le template applicatif anime
  // chaque page avec `animate-page-in`, dont l'état final conserve un
  // `transform`. Or un ancêtre transformé devient le BLOC CONTENEUR des
  // descendants `position: fixed` — la coquille se retrouvait alors calée sur
  // une boîte de hauteur nulle, et la page de création s'affichait vide.
  // Monté dans `document.body`, le plein écran est de nouveau le plein écran.
  //
  // `useSyncExternalStore` plutôt qu'un effet : il vaut `false` au rendu
  // serveur et `true` dès le premier rendu client, sans dépendre d'un effet
  // différé — une première tentative via `useEffect` + `setTimeout` ne
  // basculait jamais, et la coquille restait coincée dans son parent animé.
  const mounted = React.useSyncExternalStore(noSubscribe, () => true, () => false);

  const shell = (
    <div
      className={cn(
        "nireo-form fixed inset-0 z-50 flex flex-col overflow-hidden bg-background",
        className
      )}
    >
      {children}
    </div>
  );

  // Avant l'hydratation, on rend en place : le contenu reste dans le HTML
  // servi (donc lisible et référencé), il change simplement de parent ensuite.
  return mounted ? createPortal(shell, document.body) : shell;
}

/* ------------------------------------------------------------------ */
/*  Barre du haut : retour, marque, sortie                            */
/* ------------------------------------------------------------------ */

export function FormTopBar({
  onBack,
  backHref,
  onExit,
  exitLabel = "Quitter",
  exitHref,
}: {
  /** Retour à l'étape précédente (absent = première étape). */
  onBack?: () => void;
  /** Retour hors du parcours quand il n'y a pas d'étape précédente. */
  backHref?: string;
  onExit?: () => void;
  exitLabel?: string;
  exitHref?: string;
}) {
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-2 px-2 pb-2"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Étape précédente"
          className="grid size-11 place-items-center rounded-lg text-foreground transition-colors duration-200 hover:bg-accent"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
      ) : backHref ? (
        <Link
          href={backHref}
          aria-label="Revenir en arrière"
          className="grid size-11 place-items-center rounded-lg text-foreground transition-colors duration-200 hover:bg-accent"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      ) : (
        <span className="size-11" aria-hidden />
      )}

      {/* La marque, au vrai logo — pas d'icône d'immeuble dans un rond bleu. */}
      <span className="flex items-center gap-2">
        <NireoMark flat className="size-7 rounded-[0.4rem]" />
        <span className="text-[0.95rem] font-semibold tracking-[-0.03em] text-foreground">
          Nireo
        </span>
      </span>

      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          {exitLabel}
        </button>
      ) : exitHref ? (
        <Link
          href={exitHref}
          className="flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          {exitLabel}
        </Link>
      ) : (
        <span className="size-11" aria-hidden />
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Progression                                                        */
/* ------------------------------------------------------------------ */

export function FormProgress({
  step,
  total,
  label,
}: {
  /** Étape courante, à partir de 1. */
  step: number;
  total: number;
  /** Libellé personnalisé (« Étape 1 sur 3 » par défaut). */
  label?: string;
}) {
  const text = label ?? `Étape ${step} sur ${total}`;
  return (
    <div className="space-y-2">
      <p className="text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
        {text}
      </p>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={text}
      >
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              index < step ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Corps défilant                                                     */
/* ------------------------------------------------------------------ */

/**
 * Zone défilante du formulaire. `max-w-xl` : une ligne de saisie confortable
 * au bureau, jamais un champ étiré sur 1400 px.
 */
export function FormBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5", className)}
      style={{ paddingBottom: "calc(var(--form-actions-h) + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  );
}

/** Titre éditorial d'étape : la question posée, puis ce qu'elle sert à faire. */
export function FormHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2 pt-6 pb-7">
      <h1 className="text-[1.75rem] leading-[1.12] font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Actions fixes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Une action principale dominante, une action secondaire en LIEN.
 * Jamais deux boutons de poids égal : « Annuler » ne doit pas peser autant
 * que « Continuer ».
 */
export function FormActions({
  children,
  secondary,
  note,
}: {
  /** L'action principale (bouton pleine largeur). */
  children: React.ReactNode;
  /** Action secondaire, rendue en lien discret sous le bouton. */
  secondary?: React.ReactNode;
  /** Mention affichée au-dessus du bouton (aide, quota…). */
  note?: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 pt-3 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-xl space-y-2">
        {note}
        {children}
        {secondary ? (
          <div className="flex justify-center pt-0.5">{secondary}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Lien d'action secondaire (« Je terminerai plus tard », « Passer »). */
export function FormSecondaryAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 transition-opacity hover:underline disabled:opacity-50"
    >
      {children}
    </button>
  );
}
