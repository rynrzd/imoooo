"use client";

import * as React from "react";
import { DocumentsScreen, MoneyScreen, RentsScreen } from "@/components/landing/nireo-screen";
import { cn } from "@/lib/utils";

/**
 * Section produit immersive.
 *
 * Un grand écran Nireo reste présent pendant le défilement pendant que le
 * récit avance en trois temps : les loyers, les documents, puis les chiffres.
 * L'écran change d'état par fondu, et chaque état rejoue ses micro-animations
 * internes (une échéance qui passe à « Payé », des documents qui rejoignent
 * leur logement, des dépenses qui se remplissent).
 *
 * Robustesse :
 * - le premier chapitre est actif dès le rendu serveur : si l'observateur ne
 *   démarre jamais, un écran reste affiché et les textes sont tous lisibles ;
 * - sur mobile, aucun collage ni observation : chaque chapitre porte son
 *   propre écran, à la suite (le panneau collant est simplement masqué) ;
 * - hors écran, aucune animation ne tourne : `data-active` n'est posé que sur
 *   l'écran visible.
 */

const CHAPTERS = [
  {
    key: "loyers",
    eyebrow: "Loyers",
    title: "Ce mois-ci, tout est sous contrôle.",
    text: "Les échéances du mois sont générées à partir de vos baux actifs. Vous pointez, vous encaissez, vous voyez ce qui reste.",
    points: [
      "Loyers attendus et déjà encaissés",
      "Une échéance passe à « Payé » en un geste",
      "Les retards ressortent d’eux-mêmes",
    ],
    Screen: RentsScreen,
  },
  {
    key: "documents",
    eyebrow: "Documents",
    title: "Chaque document retrouve le bon logement.",
    text: "Bail, assurance, facture, diagnostic : chaque fichier est déposé dans le dossier du logement concerné, pas dans un dossier de plus.",
    points: [
      "Baux, assurances, diagnostics et factures",
      "Rangés par logement, pas par date d’envoi",
      "Espace privé, accessible à votre seul compte",
    ],
    Screen: DocumentsScreen,
  },
  {
    key: "argent",
    eyebrow: "Dépenses & travaux",
    title: "Vos chiffres, sans refaire les calculs.",
    text: "Les dépenses et les chantiers sont rattachés au logement. Revenus, dépenses et rentabilité se mettent à jour tout seuls.",
    points: [
      "Dépenses classées par catégorie",
      "Travaux suivis avec leur budget engagé",
      "Résultat net et rentabilité, à jour",
    ],
    Screen: MoneyScreen,
  },
] as const;

export function ProductStory() {
  /** Chapitre affiché dans le panneau collant (ordinateur). */
  const [active, setActive] = React.useState(0);
  /** Chapitres déjà arrivés à l'écran (anime l'aperçu en ligne, sur mobile). */
  const [seen, setSeen] = React.useState<boolean[]>(() => CHAPTERS.map((_, i) => i === 0));
  const chapters = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = chapters.current.filter((el): el is HTMLDivElement => Boolean(el));
    const indexOf = (target: Element) => chapters.current.findIndex((el) => el === target);

    // Bande étroite au milieu de l'écran : le chapitre qui la traverse devient
    // l'état affiché — le changement suit donc réellement le défilement.
    const follow = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = indexOf(entry.target);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: "-48% 0px -48% 0px" }
    );

    // Arrivée à l'écran : anime l'aperçu du chapitre, une seule fois.
    const enter = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = indexOf(entry.target);
          if (index < 0) continue;
          enter.unobserve(entry.target);
          setSeen((prev) => (prev[index] ? prev : prev.map((v, i) => v || i === index)));
        }
      },
      { rootMargin: "0px 0px -15% 0px" }
    );

    elements.forEach((el) => {
      follow.observe(el);
      enter.observe(el);
    });
    return () => {
      follow.disconnect();
      enter.disconnect();
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-12">
      {/* ------- Écran collant (ordinateur uniquement) ------- */}
      <div className="hidden lg:col-span-6 lg:col-start-1 lg:block lg:self-start lg:sticky lg:top-[calc(var(--land-header-h)_+_3rem)]">
        <div className="relative">
          {CHAPTERS.map((chapter, i) => (
            <div
              key={chapter.key}
              aria-hidden={i !== active}
              className={cn(
                "transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none",
                i === active
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none absolute inset-x-0 top-0 translate-y-2 opacity-0"
              )}
            >
              <chapter.Screen active={i === active} />
            </div>
          ))}
        </div>
      </div>

      {/* ------- Récit ------- */}
      <div className="lg:col-span-5 lg:col-start-8">
        {CHAPTERS.map((chapter, i) => (
          <div
            key={chapter.key}
            ref={(el) => {
              chapters.current[i] = el;
            }}
            className={cn(
              "border-t border-border py-10 first:border-t-0 first:pt-0 sm:py-12",
              "lg:flex lg:min-h-[76svh] lg:flex-col lg:justify-center lg:border-t-0 lg:py-0"
            )}
          >
            <div className="relative lg:pl-7">
              {/* Rail de progression — aucun numéro, juste la position. */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 left-0 hidden h-[calc(100%-0.5rem)] w-px lg:block",
                  i === active ? "bg-primary" : "bg-border"
                )}
              />
              <p className="land-eyebrow text-muted-foreground">{chapter.eyebrow}</p>
              <h3 className="mt-3 text-[1.5rem] font-semibold text-balance text-foreground sm:text-[1.8rem]">
                {chapter.title}
              </h3>
              <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
                {chapter.text}
              </p>
              <ul className="mt-5 space-y-2.5">
                {chapter.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[0.9rem] text-foreground">
                    <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-[var(--land-stone)]" />
                    {point}
                  </li>
                ))}
              </ul>

              {/* Mobile et tablette : l'écran suit son chapitre. */}
              <div className="mt-6 lg:hidden">
                <chapter.Screen active={seen[i]} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
