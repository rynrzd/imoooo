import Link from "next/link";
import { NireoOutline } from "@/components/landing/nireo-outline";

/**
 * Appel à l'action final — fond blanc cassé, un bouton, un lien.
 *
 * À droite, le monogramme Nireo au seul contour cobalt, volontairement coupé
 * par les bords de la section : la marque déborde du cadre plutôt que de s'y
 * ranger. Il se DESSINE quand la section entre à l'écran (`data-draw`,
 * `pathLength="100"`), une seule fois. Aucun remplissage, aucun halo, aucune
 * ombre — et c'est, avec le menu, le seul endroit de la page où ce grand
 * symbole apparaît.
 *
 * Le grand titre se révèle en deux temps, ligne par ligne, derrière un cache.
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

export function FinalCta({ href, label }: { href: string; label: string }) {
  return (
    <section
      data-lx-section="cta"
      className="relative overflow-hidden border-t border-[var(--nl-ink)]/8 bg-[var(--nl-paper)] text-[var(--nl-ink)]"
    >
      {/* Le monogramme de contour — décoratif, coupé en bas et à droite. Sur
          mobile il est plus petit, plus effacé et repoussé sous le bloc
          d'action : il ne passe jamais derrière le bouton ni le texte. */}
      <NireoOutline
        className="pointer-events-none absolute -right-14 -bottom-14 h-[15rem] w-[12rem] opacity-30 sm:-right-4 sm:-bottom-24 sm:h-[26rem] sm:w-[22rem] sm:opacity-70 lg:right-16 lg:-bottom-32 lg:h-[34rem] lg:w-[28rem]"
        stroke="var(--nl-cobalt)"
        draw
      />

      <div className="relative mx-auto w-full max-w-[82rem] px-6 py-16 sm:px-8 sm:py-28">
        <div className="nl-seq max-w-xl" data-reveal>
          <h2 className="text-[clamp(1.9rem,6vw,3.2rem)] font-semibold">
            <span data-mask-line>
              <span>Commencez là</span>
            </span>
            <span data-mask-line style={{ ["--nl-delay" as string]: "110ms" }}>
              <span>où vous en êtes.</span>
            </span>
          </h2>
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "260ms" }}
            className="mt-5 text-[clamp(0.95rem,2.4vw,1.08rem)] leading-relaxed text-[var(--nl-gray)]"
          >
            Un logement gratuit. Sans carte. Sans limite de durée.
          </p>

          <div
            data-seq
            style={{ ["--nl-delay" as string]: "340ms" }}
            className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6"
          >
            <Link
              href={href}
              data-lx="final-cta-primary"
              data-lx-cta=""
              className="nl-button nl-focus inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.98rem] font-medium whitespace-nowrap text-white hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#000)] sm:w-auto"
            >
              {label}
              <span aria-hidden className="nl-button-arrow">
                →
              </span>
            </Link>
            <Link
              href="/connexion"
              data-lx="final-cta-login"
              className="nl-focus text-[0.95rem] font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
