import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

/**
 * L'appel à l'action final : la seule respiration en bleu nuit après le hero.
 *
 * Aplat plein, aucun dégradé, aucun halo, aucune carte. La page se referme
 * comme elle s'est ouverte — texte clair sur fond sombre.
 */

export function FinalCta({ href }: { href: string }) {
  return (
    <section
      data-night
      data-lx-section="cta"
      className="bg-[var(--land-night)] text-[var(--land-paper)]"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-[1.85rem] font-semibold text-balance text-[var(--land-paper)] sm:text-[2.5rem]">
            Votre patrimoine mérite mieux qu’un tableur.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[0.98rem] leading-relaxed text-balance text-[rgb(252_251_248/0.72)]">
            Commencez avec votre premier logement et retrouvez enfin une gestion claire.
          </p>
          {/* Boutons compacts : jamais toute la largeur, même sur mobile. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={href}
              data-lx="final-cta-primary"
              data-lx-cta=""
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-primary px-5 text-[0.95rem] font-medium text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_86%,#fff)]"
            >
              Créer mon espace gratuit
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
            <Link
              href="/connexion"
              data-lx="final-cta-login"
              className="inline-flex h-11 items-center justify-center rounded-[6px] border border-[rgb(252_251_248/0.32)] px-5 text-[0.95rem] font-medium text-[var(--land-paper)] transition-colors hover:bg-[rgb(252_251_248/0.1)]"
            >
              Se connecter
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
