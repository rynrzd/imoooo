"use client";

import * as React from "react";
import { Banknote, FilePenLine, Receipt, Users } from "lucide-react";
import { NireoMark } from "@/components/marketing/nireo-logo";
import { cn } from "@/lib/utils";

/**
 * « Tout ce qui était éparpillé retrouve sa place ».
 *
 * Au départ, les quatre étiquettes (Loyers, Baux, Factures, Locataires) sont
 * décalées et légèrement inclinées ; quand la section entre dans l'écran,
 * elles se rangent l'une après l'autre dans le cadre Nireo. Aucun clic, aucune
 * seconde application : juste un cadre simplifié.
 *
 * Technique : un IntersectionObserver bascule un attribut `data-gathered`, tout
 * le reste est en CSS (transform + opacity). Rien n'est lié au scroll frame par
 * frame — pas de listener de défilement, pas de canvas.
 * - sans JavaScript / avec `prefers-reduced-motion` : état rangé d'emblée ;
 * - sur mobile : le décalage est vertical et court (jamais de débordement).
 */

const ITEMS = [
  {
    icon: Banknote,
    label: "Loyers",
    detail: "Échéances, encaissements et retards",
    /* Décalage de départ : mobile discret, puis dispersion sur grand écran. */
    scatter: "[--dx:-8px] [--dy:-14px] [--r:-3deg] sm:[--dx:-120px] sm:[--dy:-58px] sm:[--r:-7deg]",
  },
  {
    icon: FilePenLine,
    label: "Baux",
    detail: "Bail, dépôt de garantie, dates d’entrée et de sortie",
    scatter: "[--dx:10px] [--dy:-8px] [--r:4deg] sm:[--dx:138px] sm:[--dy:-34px] sm:[--r:6deg]",
  },
  {
    icon: Receipt,
    label: "Factures",
    detail: "Dépenses et justificatifs classés par catégorie",
    scatter: "[--dx:-10px] [--dy:10px] [--r:3deg] sm:[--dx:-132px] sm:[--dy:38px] sm:[--r:5deg]",
  },
  {
    icon: Users,
    label: "Locataires",
    detail: "Contacts et bail rattachés à chaque logement",
    scatter: "[--dx:8px] [--dy:16px] [--r:-4deg] sm:[--dx:126px] sm:[--dy:62px] sm:[--r:-6deg]",
  },
];

export function UnifyScene() {
  const ref = React.useRef<HTMLDivElement>(null);
  // Rendu serveur = état rangé : le contenu est lisible sans JavaScript.
  const [gathered, setGathered] = React.useState(true);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Déjà visible : on ne disperse pas (aucun sursaut au chargement).
    if (element.getBoundingClientRect().top < window.innerHeight * 0.8) return;

    setGathered(false);
    const done = () => {
      setGathered(true);
      observer.disconnect();
      window.clearTimeout(fallback);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) done();
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    observer.observe(element);
    // Filet de sécurité : le contenu ne reste jamais dispersé.
    const fallback = window.setTimeout(done, 3000);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div ref={ref} className="mx-auto mt-8 max-w-2xl overflow-hidden px-1 pt-2 pb-0.5 sm:mt-10 sm:px-10 sm:py-6">
      {/* UNE SEULE enveloppe : à l'intérieur, de simples lignes séparées par un
          filet — jamais une carte encadrée par élément. */}
      <div
        data-gathered={gathered ? "" : undefined}
        className="group/scene nireo-glass rounded-2xl px-3.5 py-3 sm:rounded-3xl sm:px-6 sm:py-5"
      >
        <div className="flex items-center gap-2.5 border-b border-border pb-3">
          <NireoMark className="size-7 sm:size-8" />
          <span className="text-sm font-medium text-foreground">Votre espace Nireo</span>
          <span className="ml-auto hidden text-[11px] text-muted-foreground min-[400px]:block">
            1 logement · tout au même endroit
          </span>
        </div>

        <ul className="divide-y divide-border">
          {ITEMS.map((item, i) => (
            <li
              key={item.label}
              style={{ transitionDelay: `${i * 110}ms` }}
              className={cn(
                "flex items-center gap-3 py-2.5 sm:py-3",
                "transition-[translate,rotate,opacity] duration-700 ease-out motion-reduce:transition-none",
                // État dispersé (tant que le parent n'a pas `data-gathered`).
                item.scatter,
                "translate-x-[var(--dx)] translate-y-[var(--dy)] rotate-[var(--r)] opacity-0",
                "group-data-[gathered]/scene:translate-x-0 group-data-[gathered]/scene:translate-y-0",
                "group-data-[gathered]/scene:rotate-0 group-data-[gathered]/scene:opacity-100"
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:size-9 sm:rounded-xl">
                <item.icon className="size-4 sm:size-4.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{item.label}</span>
                <span className="block text-[12px] leading-snug text-muted-foreground sm:leading-relaxed">
                  {item.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
