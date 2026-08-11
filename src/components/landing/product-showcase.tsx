"use client";

import * as React from "react";
import { NireoAppScreen, type ScreenState } from "@/components/landing/nireo-screen";
import { cn } from "@/lib/utils";

/**
 * La seule section produit de la page.
 *
 * Un titre, UN grand écran Nireo, et trois états qu'on parcourt : les loyers,
 * les documents, les dépenses et travaux. C'est le même écran qui change —
 * jamais trois cartes différentes, jamais une grille de fonctionnalités.
 *
 * Robustesse : sans JavaScript, le premier état est déjà rendu et lisible ;
 * les trois onglets sont de vrais boutons (`role="tab"`), navigables au
 * clavier avec les flèches, et l'écran est leur unique panneau.
 */

interface Chapter {
  key: ScreenState;
  label: string;
  /** Une phrase, pas une liste : ce que l'état montre réellement. */
  text: string;
}

const CHAPTERS: Chapter[] = [
  {
    key: "loyers",
    label: "Loyers",
    text: "Les échéances du mois sont générées depuis vos baux actifs. Vous pointez ce qui est encaissé, les retards ressortent d’eux-mêmes.",
  },
  {
    key: "documents",
    label: "Documents",
    text: "Bail, assurance, facture, diagnostic : chaque fichier est rangé dans le dossier du logement concerné, pas dans un dossier de plus.",
  },
  {
    key: "argent",
    label: "Dépenses et travaux",
    text: "Dépenses et chantiers sont rattachés au logement. Revenus, dépenses et rentabilité se recalculent tout seuls.",
  },
];

export function ProductShowcase() {
  const [active, setActive] = React.useState(0);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const next = (index + CHAPTERS.length) % CHAPTERS.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") select(active + 1);
    else if (event.key === "ArrowLeft") select(active - 1);
    else return;
    event.preventDefault();
  };

  const chapter = CHAPTERS[active];

  return (
    <div>
      {/* Onglets compacts : un filet, aucun fond de carte, aucune pilule. */}
      <div
        role="tablist"
        aria-label="Ce que Nireo réunit"
        onKeyDown={onKeyDown}
        className="-mx-5 flex gap-1 overflow-x-auto px-5 sm:mx-0 sm:px-0"
      >
        {CHAPTERS.map((item, i) => (
          <button
            key={item.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`onglet-${item.key}`}
            aria-selected={i === active}
            aria-controls="ecran-nireo"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              // Les trois libellés tiennent sur une ligne dès 360 px de large ;
              // en dessous, la bande défile plutôt que de déborder la page.
              "shrink-0 border-b-2 px-2.5 pb-2.5 text-[0.85rem] whitespace-nowrap transition-colors sm:px-3 sm:text-[0.92rem]",
              i === active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div aria-hidden className="-mt-px border-t border-border" />

      <div
        id="ecran-nireo"
        role="tabpanel"
        aria-labelledby={`onglet-${chapter.key}`}
        className="mt-7 grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-10"
      >
        <div className="lg:col-span-8">
          {/* Le cadre reste, seul son contenu change : c'est bien le même
              produit qu'on parcourt. La clé force le rejeu des micro-
              animations internes de l'état affiché. */}
          <NireoAppScreen key={chapter.key} state={chapter.key} />
        </div>

        <div className="lg:col-span-4 lg:pt-6">
          <p className="max-w-md text-[0.98rem] leading-relaxed text-muted-foreground">
            {chapter.text}
          </p>
        </div>
      </div>
    </div>
  );
}
