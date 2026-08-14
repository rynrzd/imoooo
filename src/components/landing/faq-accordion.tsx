"use client";

import * as React from "react";
import type { FaqItem } from "@/components/marketing/faq-section";

/**
 * Accordéon de la FAQ de la landing.
 *
 * Ce qui est tenu :
 * - `aria-expanded` et `aria-controls` sur le bouton, `role="region"` et
 *   `aria-labelledby` sur la réponse : la relation question / réponse est
 *   explicite pour les lecteurs d'écran ;
 * - `inert` sur une réponse fermée — elle n'est ni focalisable ni lue, alors
 *   qu'elle reste dans le HTML (donc lisible par les moteurs) ;
 * - la hauteur s'anime par `grid-template-rows: 0fr → 1fr` (cf. globals.css) :
 *   rien n'est mesuré en JavaScript, il n'y a donc aucun saut en fin
 *   d'ouverture et aucun décalage de mise en page ailleurs sur la page ;
 * - sur mobile, une seule réponse reste ouverte à la fois ; au-delà, plusieurs
 *   peuvent l'être — la place ne manque plus.
 *
 * Le contenu vient de `getFaqItems` (src/components/marketing/faq-section.tsx),
 * qui lit lui-même les quotas et les plans dans `src/config/plans.ts` : aucun
 * tarif, aucune limite n'est ressaisie ici.
 */

/** En dessous, une seule réponse ouverte à la fois. */
const SINGLE_QUERY = "(max-width: 767.98px)";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = React.useState<string[]>([]);

  const toggle = (id: string) => {
    setOpen((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id);
      const single = window.matchMedia(SINGLE_QUERY).matches;
      return single ? [id] : [...previous, id];
    });
  };

  return (
    <div className="border-t border-[var(--nl-ink)]/12">
      {items.map((item, index) => {
        const id = item.id ?? `q${index}`;
        const isOpen = open.includes(id);
        return (
          <div key={id} className="border-b border-[var(--nl-ink)]/12">
            <h3>
              <button
                type="button"
                id={`faq-q-${id}`}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${id}`}
                onClick={() => toggle(id)}
                className="nl-focus flex min-h-14 w-full items-center justify-between gap-6 py-4 text-left"
              >
                <span className="text-[1rem] font-medium text-[var(--nl-ink)] sm:text-[1.05rem]">
                  {item.question}
                </span>
                <span aria-hidden className="nl-faq-sign shrink-0 text-[var(--nl-cobalt)]" />
              </button>
            </h3>

            <div
              id={`faq-a-${id}`}
              role="region"
              aria-labelledby={`faq-q-${id}`}
              data-open={isOpen}
              inert={!isOpen}
              className="nl-faq-panel"
            >
              <div>
                <p className="max-w-[52rem] pb-5 text-[0.95rem] leading-relaxed text-[var(--nl-gray)]">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
