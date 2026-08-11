/**
 * Section signature — « Rien ne se perd. »
 *
 * Une affiche, pas une section de fonctionnalités : fond cobalt uni, trois
 * lignes de très grandes capitales décalées les unes par rapport aux autres,
 * un filet, une phrase. Aucune image, aucune grille, aucune carte, aucune
 * icône, aucun monogramme — la composition ne tient que sur la typographie,
 * les espacements et le mouvement.
 *
 * Toute l'échelle est pilotée par deux variables posées en CSS
 * (`--nl-big`, `--nl-mid`, cf. globals.css) : les décalages éditoriaux sont
 * exprimés en fraction de ces variables, le rythme reste donc identique du
 * mobile au grand écran, sans jamais de hauteur en `vh`.
 *
 * Au défilement, chaque ligne se verrouille en place — « RIEN » depuis la
 * gauche, « NE SE » depuis la droite, « PERD. » depuis la gauche — puis le
 * filet se dessine. L'état bascule via le `data-reveal` de l'observateur
 * unique de la landing : l'animation ne joue qu'une fois, et avec
 * « prefers-reduced-motion » (ou sans JavaScript) la composition finale est
 * affichée immédiatement.
 */

/** Décalage horizontal d'entrée. Assez pour se voir, jamais pour déborder. */
const SHIFT = "2.75rem";

export function LinkedSection() {
  return (
    <section className="nl-grain relative overflow-hidden bg-[var(--nl-cobalt)] text-[var(--nl-paper)]">
      {/* Mobile : 24 px sur les côtés, 72 px de respiration verticale, aucune
          hauteur minimale — la section fait ce que son contenu mesure. */}
      <div
        data-reveal
        className="nl-typo relative mx-auto w-full max-w-[1180px] px-6 py-[72px] sm:px-8 md:py-[5.5rem]"
      >
        <p
          data-nl-in
          className="text-[0.72rem] font-medium tracking-[0.22em] sm:text-[0.8rem]"
        >
          TOUT RESTE LIÉ
        </p>

        <h2 className="mt-9 sm:mt-10">
          <span
            data-nl-in
            style={{ ["--nl-shift" as string]: `-${SHIFT}`, ["--nl-delay" as string]: "60ms" }}
            className="nl-typo-word"
          >
            RIEN
          </span>
          {/* Contour seul : `-webkit-text-stroke`, avec repli plein si le
              navigateur ne le connaît pas (cf. `@supports` dans globals.css). */}
          <span
            data-nl-in
            style={{ ["--nl-shift" as string]: SHIFT, ["--nl-delay" as string]: "180ms" }}
            className="nl-typo-word nl-typo-word--outline"
          >
            NE SE
          </span>
          <span
            data-nl-in
            style={{ ["--nl-shift" as string]: `-${SHIFT}`, ["--nl-delay" as string]: "300ms" }}
            className="nl-typo-word nl-typo-word--indent"
          >
            PERD.
          </span>
        </h2>

        {/* Le filet se dessine APRÈS « PERD. », d'un seul `scaleX`. */}
        <div
          aria-hidden
          data-nl-rule
          style={{ ["--nl-delay" as string]: "800ms" }}
          className="nl-typo-rule mt-14"
        />

        <p
          data-nl-in
          style={{ ["--nl-delay" as string]: "400ms" }}
          className="mt-10 max-w-[34rem] text-[clamp(0.98rem,2.4vw,1.12rem)] leading-relaxed text-[var(--nl-paper)]/90"
        >
          Chaque information retrouve le bon logement.
        </p>
      </div>
    </section>
  );
}
