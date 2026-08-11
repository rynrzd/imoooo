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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgb(255_255_255/0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:72px_72px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(to_right,rgb(255_255_255/0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:288px_192px]"
      />

      <div className="relative mx-auto grid w-full max-w-[82rem] grid-cols-1 items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-8">
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
          <div className="relative mx-auto aspect-[200/240] w-[min(20rem,72vw)] lg:mr-0 lg:ml-auto lg:w-[min(24rem,100%)]">
            <div
              aria-hidden
              // `overflow-hidden` : l'aperçu est agrandi à 190 % pour remplir la
              // lettre, il ne doit jamais déborder de la page (le masque, lui,
              // ne découpe que le rendu, pas la boîte).
              className="absolute inset-0 overflow-hidden"
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
              {/* L'aperçu est agrandi puis recadré : ce sont bien les vrais
                  écrans de Nireo qu'on aperçoit à l'intérieur de la lettre. */}
              <div className="absolute top-0 left-1/2 w-[190%] -translate-x-1/2 origin-top">
                <ProductPreview />
              </div>
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
