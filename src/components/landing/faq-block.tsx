import Link from "next/link";
import { Plus } from "lucide-react";
import type { FaqItem } from "@/components/marketing/faq-section";
import { PILLAR_PAGE, RESOURCES_PAGE } from "@/config/seo-pages";

/**
 * FAQ de la landing — accordéon natif `<details>` : clavier, lecteurs
 * d'écran et indexation pris en charge par le navigateur, sans une ligne de
 * JavaScript. Les réponses sont TOUJOURS dans le HTML servi : le balisage
 * FAQPage de la page ne peut donc pas décrire un contenu invisible.
 *
 * La colonne de gauche porte aussi le maillage interne vers la page pilier
 * et l'espace de contenu — les deux liens historiques de cette section.
 */
export function FaqBlock({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-4">
        <p className="land-eyebrow text-muted-foreground">Questions fréquentes</p>
        <h2 className="mt-4 text-[1.9rem] font-semibold text-balance text-foreground sm:text-[2.3rem]">
          Ce qu’on nous demande avant de commencer.
        </h2>
        <p className="mt-4 text-[0.92rem] leading-relaxed text-muted-foreground">
          Besoin d’une explication plus complète ? Lisez la page{" "}
          <Link
            href={PILLAR_PAGE.path}
            className="font-medium text-foreground underline decoration-[var(--land-stone)] underline-offset-4 transition-colors hover:decoration-primary"
          >
            logiciel de gestion locative
          </Link>{" "}
          ou parcourez nos{" "}
          <Link
            href={RESOURCES_PAGE.path}
            className="font-medium text-foreground underline decoration-[var(--land-stone)] underline-offset-4 transition-colors hover:decoration-primary"
          >
            ressources
          </Link>
          .
        </p>
      </div>

      <div className="lg:col-span-7 lg:col-start-6">
        <div className="border-t border-border">
          {items.map((item) => (
            <details key={item.question} className="group border-b border-border">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[0.98rem] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <p className="max-w-2xl pb-5 text-[0.92rem] leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
