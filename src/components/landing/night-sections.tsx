import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Les deux respirations en bleu nuit de la page : la rupture éditoriale au
 * milieu du parcours, et l'appel à l'action final.
 *
 * Aplats pleins, aucun dégradé, aucun halo. Le décor est une élévation
 * d'immeuble tracée en filets — pas une photographie de stock, pas une image
 * générée : le projet n'a aucune photographie immobilière authentique dans
 * ses assets, on ne la remplace donc pas par un faux.
 */

/* ------------------------------------------------------------------ */
/*  Rupture éditoriale                                                */
/* ------------------------------------------------------------------ */

/** Élévation d'immeuble : filets verticaux et alignements de fenêtres. */
function Elevation() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 200"
      fill="none"
      preserveAspectRatio="xMidYMax meet"
      className="h-full w-full text-[var(--land-paper)]"
    >
      <g stroke="currentColor" strokeWidth="0.75" opacity="0.22">
        {/* Corps du bâtiment */}
        <path d="M40 199V44h110v155M150 44 95 16 40 44" />
        <path d="M150 76h130v123M280 76v123" />
        {/* Étages */}
        {[76, 108, 140, 172].map((y) => (
          <path key={`f${y}`} d={`M40 ${y}h110`} />
        ))}
        {[108, 140, 172].map((y) => (
          <path key={`g${y}`} d={`M150 ${y}h130`} />
        ))}
        {/* Percements */}
        {[62, 94, 126, 158].map((y) =>
          [58, 86, 114].map((x) => (
            <rect key={`w${x}-${y}`} x={x} y={y} width="14" height="18" />
          ))
        )}
        {[94, 126, 158].map((y) =>
          [170, 200, 230, 260].map((x) => (
            <rect key={`v${x}-${y}`} x={x} y={y} width="12" height="16" />
          ))
        )}
      </g>
      <path d="M0 199h320" stroke="currentColor" strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

/** Petite information reprise de l'interface — telle qu'elle s'y affiche. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgb(252_251_248/0.22)] px-2.5 py-1 text-[0.78rem] font-medium text-[var(--land-paper)]">
      <Check className="size-3.5 shrink-0 text-[var(--land-green-light)]" aria-hidden />
      {children}
    </span>
  );
}

export function EditorialBreak() {
  return (
    <section data-night className="bg-[var(--land-night)] text-[var(--land-paper)]">
      <div className="mx-auto grid w-full max-w-[76rem] grid-cols-1 items-end gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <Reveal className="lg:col-span-7">
          <p className="land-eyebrow text-[rgb(252_251_248/0.55)]">Le fond du sujet</p>
          <h2 className="mt-5 text-[2rem] leading-[1.08] font-semibold text-[var(--land-paper)] sm:text-[2.8rem] lg:text-[3.1rem]">
            Vous avez investi dans l’immobilier.
            <span className="mt-1 block">
              Pas dans <span className="land-serif">l’administratif</span>.
            </span>
          </h2>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Chip>Loyer reçu</Chip>
            <Chip>Bail à jour</Chip>
          </div>
        </Reveal>

        <div aria-hidden className="hidden h-44 lg:col-span-5 lg:block lg:h-56">
          <Elevation />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Appel à l'action final                                            */
/* ------------------------------------------------------------------ */

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
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={href}
              data-lx="final-cta-primary"
              data-lx-cta=""
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[var(--land-paper)] px-6 text-[0.95rem] font-medium text-[var(--land-night)] transition-colors hover:bg-white sm:w-auto"
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
              className="inline-flex h-12 w-full items-center justify-center rounded-[6px] border border-[rgb(252_251_248/0.28)] px-6 text-[0.95rem] font-medium text-[var(--land-paper)] transition-colors hover:bg-[rgb(252_251_248/0.08)] sm:w-auto"
            >
              Se connecter
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
