import Link from "next/link";

/**
 * Appel à l'action final — fond blanc cassé, un bouton, un lien.
 *
 * À droite, un très grand « N » dessiné au seul contour cobalt, volontairement
 * coupé par les bords de la section : la marque déborde du cadre plutôt que de
 * s'y ranger. Aucun remplissage, aucun halo, aucune ombre.
 *
 * Les deux destinations sont les vraies routes du produit : l'inscription
 * existante (personnalisée par le moteur pour un visiteur déjà connecté) et
 * la connexion existante. Aucun tarif ici : le plan Gratuit est celui de tout
 * nouveau compte, et le choix d'un plan payant n'arrive que le jour où la
 * limite gratuite est atteinte.
 *
 * Le libellé du bouton vient du MÊME payload que celui du hero
 * (`hero_cta`) : les appels à l'action principaux ne peuvent donc pas
 * diverger. Un visiteur déjà connecté garde sa formulation « tableau de
 * bord », un visiteur anonyme lit « Créer mon espace gratuit ».
 */

/** Le même contour de monogramme que la section signature. */
const N_PATH = "M0 240 V0 H44 L156 168 V0 H200 V240 H156 L44 72 V240 Z";

export function FinalCta({ href, label }: { href: string; label: string }) {
  return (
    <section
      data-lx-section="cta"
      className="relative overflow-hidden bg-[var(--nl-paper)] text-[var(--nl-ink)]"
    >
      {/* Le « N » de contour — décoratif, coupé en bas et à droite. Sur mobile
          il est plus petit, plus effacé et repoussé sous le bloc d'action : il
          ne passe jamais derrière le bouton ni le texte. */}
      <svg
        aria-hidden
        viewBox="0 0 200 240"
        preserveAspectRatio="xMidYMin slice"
        className="pointer-events-none absolute -right-14 -bottom-14 h-[15rem] w-[12rem] opacity-30 sm:-right-4 sm:-bottom-24 sm:h-[26rem] sm:w-[22rem] sm:opacity-70 lg:right-16 lg:-bottom-32 lg:h-[34rem] lg:w-[28rem]"
      >
        <path
          d={N_PATH}
          fill="none"
          stroke="var(--nl-cobalt)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="relative mx-auto w-full max-w-[82rem] px-6 py-16 sm:px-8 sm:py-28">
        <div className="max-w-xl" data-reveal>
          <h2 className="text-[clamp(1.9rem,6vw,3.2rem)] font-semibold text-balance">
            Commencez là où vous en êtes.
          </h2>
          <p className="mt-5 text-[clamp(0.95rem,2.4vw,1.08rem)] leading-relaxed text-[var(--nl-gray)]">
            Un logement gratuit. Sans carte. Sans limite de durée.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href={href}
              data-lx="final-cta-primary"
              data-lx-cta=""
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.98rem] font-medium whitespace-nowrap text-white transition-colors hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#000)] focus-visible:ring-2 focus-visible:ring-[var(--nl-cobalt)] focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
            >
              {label}
            </Link>
            <Link
              href="/connexion"
              data-lx="final-cta-login"
              className="text-[0.95rem] font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--nl-cobalt)] focus-visible:outline-none"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
