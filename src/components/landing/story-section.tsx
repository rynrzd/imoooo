import Image from "next/image";

/**
 * Section éditoriale — « Un logement. Toute son histoire. »
 *
 * Une seule idée : tout ce qui arrive dans Nireo se raccroche au bon bien.
 * Elle est racontée par un FIL, pas par une grille de cartes — trois
 * événements qui s'accrochent l'un après l'autre à une ligne cobalt, et la
 * ligne finit sur le logement.
 *
 * La photographie est l'asset déjà présent dans le projet
 * (`public/photos/hero-appartement.jpg`, cf. public/photos/CREDITS.md),
 * recadré serré sur la pièce éclairée : aucune image distante, aucun visuel
 * ajouté. Le cadre a un rapport d'aspect fixe, la mise en page ne bouge donc
 * jamais pendant le chargement.
 *
 * Toute la séquence est déclenchée UNE fois par le `data-reveal` du conteneur
 * (`.nl-seq`), pas élément par élément : sans JavaScript ou en mouvement
 * réduit, la composition finale est affichée immédiatement. Sur mobile c'est
 * la même séquence, simplement empilée — jamais de défilement détourné.
 */

/**
 * Les trois événements, dans l'ordre où le fil les rattrape. `link` est le
 * segment qui part du point vers l'événement suivant.
 */
const EVENTS = [
  { label: "Bail signé", dot: 420, link: 520 },
  { label: "Loyer d’août encaissé", dot: 700, link: 800 },
  { label: "Facture chaudière classée", dot: 980, link: 1080 },
];

/** Où tout aboutit. */
const DESTINATION = "T2 Part-Dieu";
const DESTINATION_DELAY = 1280;

export function StorySection() {
  return (
    <section id="histoire" className="bg-[var(--nl-paper)] py-16 text-[var(--nl-ink)] sm:py-28">
      <div
        data-reveal
        className="nl-seq mx-auto grid w-full max-w-[82rem] grid-cols-1 items-center gap-10 px-6 sm:px-8 lg:grid-cols-12 lg:gap-14"
      >
        {/* ---------------- La photographie ---------------- */}
        <div className="lg:col-span-5">
          {/* Cadrage SERRÉ sur la pièce éclairée (la zone lumineuse de la
              source occupe 52 % à 90 % de sa largeur) : c'est le même fichier
              que le hero, mais on n'y voit plus la même image — le hero montre
              la porte, cette section montre ce qu'il y a derrière. Le format
              est portrait pour que la fenêtre de recadrage soit assez étroite
              pour laisser le battant sombre hors champ. */}
          <div
            data-seq-mask
            style={{ ["--nl-delay" as string]: "180ms" }}
            className="nl-photo-zoom relative mx-auto aspect-[4/5] w-full max-w-[26rem] overflow-hidden rounded-lg lg:mx-0 lg:max-w-none"
          >
            <Image
              src="/photos/hero-appartement.jpg"
              alt="Séjour d’un appartement ancien : parquet en point de Hongrie, cheminée en marbre et fenêtres ouvertes sur les toits"
              fill
              sizes="(min-width: 1024px) 34rem, (min-width: 640px) 26rem, 100vw"
              className="object-cover object-[88%_58%]"
            />
          </div>
        </div>

        {/* ---------------- Le fil ---------------- */}
        <div className="lg:col-span-7">
          {/* Filet qui se trace devant l'intertitre : la signature commune
              des trois sections éditoriales de la page. */}
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
            TOUT PART DU BIEN
          </p>

          <h2 className="mt-6 text-[clamp(1.9rem,6vw,3.2rem)] font-semibold">
            <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
              <span>Un logement.</span>
            </span>
            <span data-mask-line style={{ ["--nl-delay" as string]: "170ms" }}>
              <span>Toute son histoire.</span>
            </span>
          </h2>

          <p
            data-seq
            style={{ ["--nl-delay" as string]: "280ms" }}
            className="mt-5 max-w-[34rem] text-[clamp(0.95rem,2.4vw,1.08rem)] leading-relaxed text-[var(--nl-gray)]"
          >
            Chaque document, paiement et dépense reste attaché au bon logement.
          </p>

          <ol className="mt-10">
            {EVENTS.map((event) => (
              <li key={event.label} className="nl-thread-row">
                <span
                  aria-hidden
                  data-seq-pop
                  style={{ ["--nl-delay" as string]: `${event.dot}ms` }}
                  className="nl-thread-dot"
                />
                {/* Le segment qui rejoint l'événement suivant — et, pour le
                    dernier, le logement. */}
                <span
                  aria-hidden
                  data-seq-thread
                  style={{
                    ["--nl-delay" as string]: `${event.link}ms`,
                    ["--nl-dur" as string]: "0.34s",
                  }}
                  className="nl-thread-link"
                />
                <span
                  data-seq
                  style={{ ["--nl-delay" as string]: `${event.dot}ms` }}
                  className="block font-medium"
                >
                  {event.label}
                </span>
              </li>
            ))}

            <li className="nl-thread-row">
              <span
                aria-hidden
                data-seq-pop
                style={{ ["--nl-delay" as string]: `${DESTINATION_DELAY}ms` }}
                className="nl-thread-dot nl-thread-dot--end"
              />
              <span
                data-seq
                style={{ ["--nl-delay" as string]: `${DESTINATION_DELAY}ms` }}
                className="block text-[1.15em] font-semibold text-[var(--nl-cobalt)]"
              >
                {DESTINATION}
              </span>
            </li>
          </ol>

          {/* La conclusion n'arrive qu'une fois le fil complet — et le
              balayage bleu passe sous « chercher » juste après, comme une
              rature de ce qu'on n'a plus à faire. */}
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "1500ms" }}
            className="mt-8 max-w-[30rem] text-[clamp(0.95rem,2.4vw,1.08rem)] leading-relaxed text-[var(--nl-gray)]"
          >
            Plus besoin de{" "}
            <span
              data-sweep
              style={{ ["--nl-delay" as string]: "1780ms" }}
              className="text-[var(--nl-ink)]"
            >
              chercher
            </span>{" "}
            où se trouve l’information.
          </p>
        </div>
      </div>
    </section>
  );
}
