import { ProductPreview } from "@/components/landing/product-preview";

/**
 * Section signature — « Tout reste lié. »
 *
 * L'interface présentée juste au-dessus redescend ici et se découpe dans un
 * grand « N » : le produit devient l'identité de la marque. Le « N » est un
 * MASQUE CSS (`mask-image`, chemin SVG en data-URI) appliqué à l'aperçu réel,
 * pas une image — il reste donc net à toutes les tailles, et le contenu
 * masqué est le vrai produit, jamais une capture décorative.
 *
 * Une seule ligne très fine traverse la section et rejoint le « N », terminée
 * par un unique point. Fond cobalt profond avec une texture de plan
 * d'appartement en lignes ton sur ton, très en retrait. Aucun halo.
 *
 * Au défilement : le masque se dévoile du bas vers le haut et la ligne se
 * dessine. Les deux sont désactivés par « prefers-reduced-motion ».
 */

/**
 * Contour du « N », dans un viewBox 200 × 240. Deux jambages pleins et une
 * diagonale — la forme du monogramme Nireo, pas une lettre de police.
 */
const N_PATH =
  "M0 240 V0 H44 L156 168 V0 H200 V240 H156 L44 72 V240 Z";

/**
 * Le même chemin, encodé pour `mask-image`. Tout est échappé, espaces compris :
 * une data-URI contenant des espaces bruts n'est pas valide partout.
 */
const N_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" preserveAspectRatio="none"><path d="${N_PATH}" fill="#fff"/></svg>`
)}")`;

export function LinkedSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--nl-deep)] text-white">
      {/* Texture de plan d'appartement : deux trames de lignes ton sur ton,
          à peine perceptibles. Aucun dégradé, aucune tache. */}
      {/* Trame resserrée et un peu plus discrète sur petit écran, où elle est
          vue de beaucoup plus près. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(to_right,rgb(255_255_255/0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:48px_48px] md:opacity-[0.16] md:[background-size:72px_72px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,rgb(255_255_255/0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:192px_144px] md:opacity-[0.1] md:[background-size:288px_192px]"
      />

      {/* Mobile : 64 px de respiration verticale, 24 px sur les côtés, texte à
          gauche et « N » centré dessous. Aucune hauteur minimale. */}
      <div className="relative mx-auto grid w-full max-w-[82rem] grid-cols-1 items-center gap-10 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-6" data-reveal>
          <h2 className="text-[clamp(2rem,6.4vw,3.6rem)] font-semibold text-white">
            Tout reste lié.
          </h2>
          <p className="mt-6 max-w-md text-[clamp(0.98rem,2.4vw,1.12rem)] leading-relaxed text-white/75">
            <span className="block">Chaque information suit le bon logement,</span>
            <span className="block">sans changer d’outil.</span>
          </p>

          {/* La ligne unique — elle part du texte et rejoint le « N », avec un
              seul point final. Masquée sur mobile, où le « N » passe SOUS le
              texte et où la ligne n'aurait rien à relier. */}
          <div aria-hidden className="mt-14 hidden items-center gap-2 lg:flex">
            <span
              data-line
              style={{ ["--nl-delay" as string]: "240ms" }}
              className="h-px flex-1 bg-white/55"
            />
            <span className="size-[7px] shrink-0 rounded-full bg-white" />
          </div>
        </div>

        {/* -------- Le « N » découpé dans l'interface réelle -------- */}
        <div className="lg:col-span-6" data-reveal style={{ ["--nl-delay" as string]: "120ms" }}>
          {/* Mobile : 260 px de large → 312 px de haut (rapport 200/240), donc
              dans la fourchette voulue et sans jamais occuper l'écran entier.
              Au-dessus de `lg`, dimensions inchangées. */}
          <div className="relative mx-auto aspect-[200/240] w-[min(260px,68vw)] sm:w-[min(20rem,52vw)] lg:mr-0 lg:ml-auto lg:w-[min(24rem,100%)]">
            <div
              aria-hidden
              // `overflow-hidden` : l'aperçu est agrandi pour remplir la lettre,
              // il ne doit jamais déborder de la page (le masque, lui, ne
              // découpe que le rendu, pas la boîte).
              // Fond clair sous l'aperçu réduit : la lettre reste PLEINE même
              // si la texture ne descend pas jusqu'à la pointe du « N ».
              className="absolute inset-0 overflow-hidden bg-[#f7f8f9] md:bg-transparent"
              data-unmask
              style={{
                maskImage: N_MASK,
                WebkitMaskImage: N_MASK,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
              }}
            >
              {/* Ce sont bien les vrais écrans de Nireo qu'on aperçoit dans la
                  lettre. Sur mobile ils sont RÉDUITS (la mise en page y est
                  déjà empilée, donc beaucoup plus haute) : à cette échelle le
                  texte n'est plus lisible, il redevient une texture — c'est
                  exactement ce qu'on veut à l'intérieur d'un monogramme.
                  L'échelle est appliquée dans un conteneur absolu : elle ne
                  laisse aucun espace vide dans la mise en page. */}
              <div className="absolute top-0 left-0 w-[620px] origin-top-left scale-[0.68] md:left-1/2 md:w-[190%] md:origin-top md:-translate-x-1/2 md:scale-100">
                <ProductPreview />
              </div>
              {/* Voile blanc : achève de transformer l'interface en texture. */}
              <div aria-hidden className="absolute inset-0 bg-white/25 md:hidden" />
            </div>

            {/* Fine bordure blanc cassé : elle redonne la forme exacte du
                monogramme par-dessus le masque. */}
            <svg
              aria-hidden
              viewBox="0 0 200 240"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path
                d={N_PATH}
                fill="none"
                stroke="var(--nl-paper)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
