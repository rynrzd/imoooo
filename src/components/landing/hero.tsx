import Image from "next/image";
import Link from "next/link";
import { HeroParallax } from "@/components/landing/motion";
import { SmoothAnchor } from "@/components/landing/smooth-anchor";

/**
 * Hero — une photographie plein écran, le hook, deux boutons.
 *
 * La photographie est un ASSET SÉPARÉ (`public/photos/hero-appartement.jpg`,
 * cf. public/photos/CREDITS.md) : le titre, les boutons et la ligne de
 * réassurance sont du vrai texte HTML posé par-dessus. Le contraste est tenu
 * par un voile d'encre dégradé depuis la gauche, jamais par la photo.
 *
 * Entrée : la photographie est DÉVOILÉE par un masque vertical pendant qu'elle
 * revient de 1,035 à 1 d'échelle — aucun fondu d'opacité, c'est l'élément LCP
 * de la page. Le hook arrive ensuite ligne à ligne, chaque ligne glissant
 * derrière son propre cache, puis le sous-titre et les boutons.
 *
 * Au défilement, la photographie prend une parallaxe très légère (un dixième
 * du défilement, plafonnée) — sur tablette et ordinateur seulement.
 *
 * Tout est désactivé par « prefers-reduced-motion », et rien n'est masqué
 * lorsque JavaScript ne s'exécute pas.
 */

export interface HeroProps {
  /** Libellés et destinations, résolus côté serveur (routes internes). */
  cta: { primary: string; href: string; secondary: string; secondaryHref: string };
  subheadline: string;
}

/** Le hook, ligne à ligne — une accroche, pas un paragraphe. */
const HOOK = ["Un loyer sur Excel.", "Un bail dans vos mails.", "Ça suffit."];

/** Asset optimisé servi depuis `public/` (voir public/photos/CREDITS.md). */
const HERO_PHOTO = "/photos/hero-appartement.jpg";

/**
 * Décalage d'entrée : suit l'écran d'introduction quand il joue, immédiat
 * sinon (visite suivante, mouvement réduit, sans JavaScript).
 */
function rise(ms: number) {
  return { animationDelay: `calc(var(--nl-intro-delay, 0ms) + ${ms}ms)` };
}

export function LandingHero({ cta, subheadline }: HeroProps) {
  // Le sous-titre s'affiche sur deux lignes, comme la maquette. La coupe suit
  // les phrases : aucun mot n'est perdu si la formulation change.
  const sentences = subheadline.split(/(?<=\.)\s+/);
  const promise = sentences[0];
  const place = sentences.slice(1).join(" ");

  return (
    // `#decouvrir` : la première entrée du menu ramène ici, tout en haut.
    <section
      id="decouvrir"
      className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-[var(--nl-night)] md:justify-center"
    >
      <HeroParallax>
        <Image
          src={HERO_PHOTO}
          alt="Appartement haussmannien vu depuis une porte entrouverte : parquet en point de Hongrie, cheminée en marbre et fenêtres ouvertes sur les toits"
          fill
          priority
          sizes="100vw"
          // Cadrage, réglé écran par écran (valeurs vérifiées en composant le
          // rendu réel, cf. public/photos/CREDITS.md) :
          // - dès `md`, l'image est presque au format du hero, on reste près du
          //   centre : le battant sombre tient la gauche — c'est lui qui porte
          //   le texte — et la lumière reste à droite ;
          // - sur mobile le recadrage est sévère (on ne voit qu'un tiers de la
          //   largeur) : 55 % garde l'encadrement de la porte à gauche ET la
          //   pièce éclairée à droite. Plus bas on ne verrait qu'un battant
          //   noir, plus haut la porte disparaîtrait.
          // Tant que l'image n'est pas chargée, c'est le bleu nuit de la
          // section qui occupe l'écran — aucun saut de mise en page.
          className="nl-photo-in object-cover object-[55%_50%] md:object-[45%_50%]"
        />
      </HeroParallax>

      {/* Voile d'encre. La photographie apporte déjà sa zone sombre (le
          battant), le voile ne fait donc que GARANTIR le contraste : il reste
          léger, sinon il écraserait les détails de la porte et du parquet.
          Vertical sur mobile (le texte descend en bas de l'écran), depuis la
          gauche à partir de la tablette. Deux aplats dégradés — aucune ombre
          diffuse, aucun flou. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(7_12_21/0.92)_20%,rgb(7_12_21/0.75)_54%,rgb(7_12_21/0.35)_78%,rgb(7_12_21/0.12)_100%)] md:hidden"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden bg-[linear-gradient(100deg,rgb(7_12_21/0.72)_0%,rgb(7_12_21/0.66)_40%,rgb(7_12_21/0.5)_62%,rgb(7_12_21/0.22)_80%,rgb(7_12_21/0.08)_100%)] md:block"
      />

      <div
        className="mx-auto w-full max-w-[82rem] px-5 pb-12 sm:px-8 sm:pb-16"
        style={{ paddingTop: "calc(var(--nl-header-h) + 2.5rem)" }}
      >
        {/* La ligne la plus longue du hook fait ≈ 10,9 em : la taille fluide la
            garde sur UNE ligne de 320 px à 2560 px. Le hook tient donc toujours
            en trois lignes, y compris sur le premier écran mobile.
            La borne haute (4 rem) est aussi ce qui maintient le titre dans la
            zone sombre de la photographie sur les très grands écrans. */}
        {/* Chaque ligne glisse derrière son propre cache (`.nl-line`) : c'est
            une découpe, pas un fondu. Le rembourrage compensé de la classe
            évite que les accents et les jambages soient rognés. */}
        <h1 className="text-[clamp(1.75rem,7.6vw,4rem)] leading-[1.06] font-semibold text-white">
          {HOOK.map((line, i) => (
            <span key={line} className="nl-line">
              <span style={rise(60 + i * 90)}>{line}</span>
            </span>
          ))}
        </h1>

        <p
          className="nl-rise mt-6 max-w-[34rem] text-[clamp(0.98rem,2.6vw,1.15rem)] leading-relaxed text-white/85"
          style={rise(360)}
        >
          <span className="block">{promise}</span>
          {place ? <span className="block">{place}</span> : null}
        </p>

        {/* Les deux boutons n'entrent pas ensemble : le principal d'abord, le
            secondaire 90 ms plus tard. C'est ce décalage qui dit lequel des
            deux compte. */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={cta.href}
            data-lx="hero-cta-primary"
            data-lx-cta=""
            style={rise(440)}
            className="nl-rise nl-button nl-focus inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.98rem] font-medium whitespace-nowrap text-white hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#fff)] sm:w-auto"
          >
            {cta.primary}
            {/* La flèche n'avance qu'au survol, de quatre pixels — jamais de
                mouvement permanent (cf. `.nl-button`, globals.css). */}
            <span aria-hidden className="nl-button-arrow">
              →
            </span>
          </Link>
          <SmoothAnchor
            href={cta.secondaryHref}
            data-lx="hero-cta-secondary"
            style={rise(530)}
            className="nl-rise nl-focus inline-flex h-12 items-center justify-center rounded-md border border-white/40 px-7 text-[0.98rem] font-medium whitespace-nowrap text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            {cta.secondary}
          </SmoothAnchor>
        </div>

        {/* Réassurance : la seule chose à savoir avant de cliquer — ce qui est
            inclus, ce que ça coûte, ce qu'on ne demande pas. Trois segments,
            pas une icône, pas une carte, pas un badge. Centrée sous les deux
            boutons tant qu'ils sont empilés, alignée sur leur bord gauche dès
            qu'ils passent côte à côte. */}
        <p
          className="nl-rise mt-8 text-center text-[0.82rem] text-white/80 sm:mt-10 sm:text-left"
          style={rise(620)}
        >
          1 logement inclus · 0 € · Sans carte bancaire
        </p>
      </div>
    </section>
  );
}
