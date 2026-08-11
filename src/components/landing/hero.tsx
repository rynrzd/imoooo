import Image from "next/image";
import Link from "next/link";

/**
 * Hero de la landing — une seule photographie, plein écran, et le hook.
 *
 * Composition (direction de référence : la maquette validée) :
 * - la photographie occupe tout le premier écran, elle n'est JAMAIS une
 *   capture contenant déjà du texte ou des boutons : c'est un asset séparé
 *   (`public/photos/sejour.jpg`, cf. son fichier CREDITS.md) sur lequel on
 *   pose du vrai texte HTML — donc sélectionnable, traduisible et indexable ;
 * - un voile d'encre dégradé depuis la gauche (depuis le bas sur mobile)
 *   garantit le contraste du texte blanc quelle que soit la photo ;
 * - le header est transparent par-dessus : le hero commence au pixel 0.
 *
 * Aucun halo, aucune boule, aucun verre, aucune carte : le seul aplat coloré
 * de l'écran est le bouton principal, en bleu Nireo.
 */

export interface HeroProps {
  /** Libellés et destinations, résolus côté serveur (routes internes). */
  cta: { primary: string; href: string; secondary: string; secondaryHref: string };
  subheadline: string;
}

/** Les trois lignes du hook — une accroche, pas un paragraphe. */
const HOOK = ["Un loyer sur Excel.", "Un bail dans vos mails.", "Ça suffit."];

/** Asset servi tel quel depuis `public/` (voir public/photos/CREDITS.md). */
const HERO_PHOTO = "/photos/sejour.jpg";

export function LandingHero({ cta, subheadline }: HeroProps) {
  return (
    // Mobile : le texte se pose au BAS de l'écran, là où le voile est le plus
    // dense — la photographie reste entière au-dessus. Écrans larges : le hook
    // est centré, le voile venant de la gauche.
    <section className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-[var(--land-night)] sm:justify-center">
      {/* ---------------- La photographie ---------------- */}
      <Image
        src={HERO_PHOTO}
        alt="Séjour d'un appartement lumineux, baie vitrée et lumière rasante"
        fill
        priority
        sizes="100vw"
        // Le cadrage garde la lumière et la fenêtre à droite du texte, sur
        // toutes les largeurs (le sujet n'est jamais rogné du mauvais côté).
        // Tant qu'elle n'est pas chargée, c'est le bleu nuit de la section qui
        // occupe l'écran : jamais de bloc blanc, jamais de saut de mise en page.
        className="-z-10 object-cover object-[68%_50%] sm:object-[60%_50%]"
      />

      {/* Voile d'encre : horizontal à partir de la tablette, vertical sur
          mobile (où le texte descend au bas de l'écran). Deux aplats
          dégradés — aucune ombre diffuse, aucun flou. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(17_24_39/0.95)_26%,rgb(17_24_39/0.82)_52%,rgb(17_24_39/0.5)_78%,rgb(17_24_39/0.36)_100%)] sm:hidden"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden bg-[linear-gradient(102deg,rgb(17_24_39/0.95)_0%,rgb(17_24_39/0.88)_32%,rgb(17_24_39/0.68)_54%,rgb(17_24_39/0.42)_76%,rgb(17_24_39/0.3)_100%)] sm:block"
      />

      <div
        className="mx-auto w-full max-w-[76rem] px-5 pb-14 sm:px-6 sm:pb-20"
        style={{
          paddingTop: "calc(var(--land-header-h) + env(safe-area-inset-top) + 3.5rem)",
        }}
      >
        {/* La ligne la plus longue du hook (« Un bail dans vos mails. ») fait
            ≈ 10,9 em : la taille fluide la garde sur UNE ligne de 320 px à
            640 px de large. Le hook tient donc toujours en trois lignes. */}
        <h1 className="text-[clamp(1.7rem,7.9vw,2.4rem)] leading-[1.05] font-semibold text-[var(--land-paper)] sm:text-[3.3rem] lg:text-[4.15rem]">
          {HOOK.map((line, i) => (
            <span key={line} className="land-rise block" style={rise(60 + i * 90)}>
              {line}
            </span>
          ))}
        </h1>

        <p
          className="land-rise mt-6 max-w-md text-[1.02rem] leading-relaxed text-[rgb(252_251_248/0.82)] sm:mt-7 sm:max-w-lg sm:text-[1.1rem]"
          style={rise(360)}
        >
          {subheadline}
        </p>

        {/* Deux boutons compacts : jamais toute la largeur, même sur mobile. */}
        <div className="land-rise mt-8 flex flex-wrap items-center gap-3" style={rise(440)}>
          <Link
            href={cta.href}
            data-lx="hero-cta-primary"
            data-lx-cta=""
            className="inline-flex h-11 items-center justify-center rounded-[6px] bg-primary px-5 text-[0.95rem] font-medium whitespace-nowrap text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_86%,#fff)]"
          >
            {cta.primary}
          </Link>
          <a
            href={cta.secondaryHref}
            data-lx="hero-cta-secondary"
            className="inline-flex h-11 items-center justify-center rounded-[6px] border border-[rgb(252_251_248/0.4)] px-5 text-[0.95rem] font-medium whitespace-nowrap text-[var(--land-paper)] transition-colors hover:bg-[rgb(252_251_248/0.1)]"
          >
            {cta.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Décalage d'entrée commun : suit le rideau d'introduction quand il joue,
 * immédiat sinon (visite suivante, mouvement réduit).
 */
function rise(ms: number) {
  return { animationDelay: `calc(var(--land-intro-delay, 0ms) + ${ms}ms)` };
}
