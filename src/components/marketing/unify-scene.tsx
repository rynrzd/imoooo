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
    scatter: "[--dx:-10px] [--dy:-26px] [--r:-4deg] sm:[--dx:-120px] sm:[--dy:-58px] sm:[--r:-7deg]",
  },
  {
    icon: FilePenLine,
    label: "Baux",
    detail: "Bail, dépôt de garantie, dates d’entrée et de sortie",
    scatter: "[--dx:12px] [--dy:-14px] [--r:5deg] sm:[--dx:138px] sm:[--dy:-34px] sm:[--r:6deg]",
  },
  {
    icon: Receipt,
    label: "Factures",
    detail: "Dépenses et justificatifs classés par catégorie",
    scatter: "[--dx:-12px] [--dy:18px] [--r:4deg] sm:[--dx:-132px] sm:[--dy:38px] sm:[--r:5deg]",
  },
  {
    icon: Users,
    label: "Locataires",
    detail: "Contacts et bail rattachés à chaque logement",
    scatter: "[--dx:10px] [--dy:28px] [--r:-5deg] sm:[--dx:126px] sm:[--dy:62px] sm:[--r:-6deg]",
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
    <div ref={ref} className="mx-auto max-w-2xl overflow-hidden px-1 py-6 sm:px-10 sm:py-10">
      <div
        data-gathered={gathered ? "" : undefined}
        className="group/scene nireo-glass rounded-3xl p-4 sm:p-6"
      >
        <div className="flex items-center gap-2.5 pb-4">
          <NireoMark className="size-8" />
          <span className="text-sm font-medium text-foreground">Votre espace Nireo</span>
          <span className="ml-auto text-[11px] text-muted-foreground">1 logement · tout au même endroit</span>
        </div>

        <ul className="space-y-2">
          {ITEMS.map((item, i) => (
            <li
              key={item.label}
              style={{ transitionDelay: `${i * 110}ms` }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-3.5 py-3",
                "transition-[translate,rotate,opacity] duration-700 ease-out motion-reduce:transition-none",
                // État dispersé (tant que le parent n'a pas `data-gathered`).
                item.scatter,
                "translate-x-[var(--dx)] translate-y-[var(--dy)] rotate-[var(--r)] opacity-0",
                "group-data-[gathered]/scene:translate-x-0 group-data-[gathered]/scene:translate-y-0",
                "group-data-[gathered]/scene:rotate-0 group-data-[gathered]/scene:opacity-100"
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{item.label}</span>
                <span className="block text-[12px] leading-relaxed text-muted-foreground">
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
