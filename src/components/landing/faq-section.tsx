import Link from "next/link";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { getFaqItems, type FaqItem } from "@/components/marketing/faq-section";

/**
 * FAQ de la landing (#faq).
 *
 * Les questions ne sont PAS réécrites ici : elles sont sélectionnées, par
 * identifiant, dans la FAQ unique de la vitrine
 * (`src/components/marketing/faq-section.tsx`), qui lit elle-même les plans,
 * les quotas et l'état réel du paiement en ligne dans `src/config/plans.ts`
 * et la configuration Stripe du serveur. Modifier une réponse là-bas la
 * modifie ici, et aucun tarif n'est recopié en dur.
 *
 * Sept questions, pas dix-sept : la FAQ complète reste sur /tarifs, aux côtés
 * de la grille tarifaire qu'elle commente. Les trois questions d'isolement,
 * d'hébergement et d'export ne figurent pas ici — la section Sécurité y
 * répond juste au-dessus, et un doublon n'aide personne.
 */

/**
 * Sélection, dans l'ordre d'affichage. Les identifiants sont ceux de
 * `getFaqItems` : si l'un disparaissait, il serait simplement ignoré plutôt
 * que de casser la page.
 */
const KEEP = [
  "essai",
  "audience",
  "nb_logements",
  "documents_photos",
  "loyers_depenses",
  "fiscalite",
  "changer_abonnement",
] as const;

/** Les questions retenues, dans l'ordre de `KEEP`. */
export function landingFaqItems({ paymentsEnabled }: { paymentsEnabled: boolean }): FaqItem[] {
  const all = getFaqItems({ paymentsEnabled });
  return KEEP.map((id) => all.find((item) => item.id === id)).filter(
    (item): item is FaqItem => Boolean(item)
  );
}

export function LandingFaq({ items }: { items: FaqItem[] }) {
  return (
    <section
      id="faq"
      data-lx-section="faq"
      className="bg-[var(--nl-paper)] py-16 text-[var(--nl-ink)] sm:py-24"
    >
      <div data-reveal className="nl-seq mx-auto w-full max-w-[82rem] px-6 sm:px-8">
        <p
          data-seq
          className="flex items-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-cobalt)] sm:text-[0.78rem]"
        >
          <span
            aria-hidden
            data-seq-rule
            style={{ ["--nl-delay" as string]: "120ms", ["--nl-dur" as string]: "0.5s" }}
            className="h-px w-8 bg-current"
          />
          QUESTIONS FRÉQUENTES
        </p>

        <h2 className="mt-6 text-[clamp(1.85rem,5.6vw,3rem)] font-semibold">
          <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
            <span>Ce qu’on nous demande.</span>
          </span>
        </h2>

        <div data-seq style={{ ["--nl-delay" as string]: "220ms" }} className="mt-10">
          <FaqAccordion items={items} />
        </div>

        <p
          data-seq
          style={{ ["--nl-delay" as string]: "300ms" }}
          className="mt-8 text-[0.92rem] text-[var(--nl-gray)]"
        >
          Le détail des plans, des quotas et de la facturation est sur la page{" "}
          <Link
            href="/tarifs"
            className="nl-focus nl-underline text-[var(--nl-cobalt)]"
          >
            Tarifs
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
