/**
 * Section « Vous n'avez pas besoin d'un outil de plus. »
 *
 * À droite, trois mots — Excel, E-mails, Dossiers — d'où partent trois filets
 * qui convergent en une seule ligne cobalt jusqu'à « Nireo ». Aucune boîte,
 * aucune icône, aucune flèche, aucun mot barré : une signature éditoriale,
 * pas un organigramme.
 *
 * Le schéma est un SVG responsive à `viewBox` : les libellés sont dans le SVG
 * (donc alignés au pixel avec leur filet à toutes les tailles) et restent du
 * vrai texte, sélectionnable et lisible par les lecteurs d'écran. La section
 * porte une description équivalente pour ceux qui ne voient pas le tracé.
 *
 * Au défilement, le schéma se CONSTRUIT dans l'ordre où on le lirait : chaque
 * libellé apparaît juste avant que son filet ne parte, les trois filets se
 * dessinent l'un après l'autre, puis la ligne unique rejoint le point
 * d'arrivée et « Nireo » se pose enfin. Rien n'est déjà là à attendre. Une
 * seule fois, aucun halo, aucune boucle.
 */

/** Ordonnée de chaque source dans le viewBox 480 × 200, et son tour. */
const SOURCES = [
  { label: "Excel", y: 32, delay: 0 },
  { label: "E-mails", y: 100, delay: 130 },
  { label: "Dossiers", y: 168, delay: 260 },
];

/** Le trait unique part quand les trois filets sont tracés. */
const JOIN_DELAY = 700;

/** Abscisse où les trois filets se rejoignent, puis où « Nireo » commence. */
const JOIN_X = 300;
const END_X = 352;

export function Centralisation() {
  return (
    // `nl-fade-to-deep` : la section suivante (Sécurité) est en bleu profond.
    // Le passage se fait par un dégradé de 6 rem, pas par une arête.
    <section className="nl-fade-to-deep bg-[var(--nl-night)] text-white">
      {/* Mobile : le schéma passe SOUS le titre (une seule colonne), avec la
          même respiration de 64 px que la section bleue. */}
      <div className="mx-auto grid w-full max-w-[82rem] grid-cols-1 items-center gap-10 px-6 py-16 sm:gap-14 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-10">
        {/* Les trois lignes sont des blocs explicites : la borne basse du
            clamp est calée pour que « Juste d'un seul endroit. » (la plus
            longue, ≈ 10,5 em) tienne sur une ligne dès 360 px de large. */}
        <h2
          className="text-[clamp(1.85rem,5.6vw,3.4rem)] font-semibold lg:col-span-6"
          data-reveal
        >
          <span className="block">Vous n’avez pas besoin</span>
          <span className="block">d’un outil de plus.</span>
          <span className="mt-2 block text-[var(--nl-cobalt-bright)]">
            Juste d’un seul endroit.
          </span>
        </h2>

        {/* `.nl-seq` : UN déclencheur pour tout le schéma, sinon chaque
            élément partirait à sa propre hauteur de défilement et la
            construction perdrait son sens. */}
        <div className="nl-seq lg:col-span-6" data-reveal>
          <p className="sr-only">
            Excel, e-mails et dossiers convergent vers un seul endroit : Nireo.
          </p>
          <svg
            aria-hidden
            viewBox="0 0 480 200"
            className="h-auto w-full max-w-[30rem] lg:ml-auto"
            fill="none"
          >
            {SOURCES.map((source) => {
              // Une courbe très douce : le filet part à l'horizontale, s'infléchit
              // au milieu, et arrive à l'horizontale sur la ligne d'arrivée.
              const d = `M96 ${source.y} H190 C240 ${source.y} 250 100 ${JOIN_X} 100`;
              return (
                <g key={source.label}>
                  <text
                    x="88"
                    y={source.y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    // Le SVG se met à l'échelle : sur mobile la taille est
                    // relevée pour que le texte rendu ne descende jamais sous
                    // 13 px réels.
                    className="fill-[#9aa0a8] text-[19px] sm:text-[15px]"
                    data-seq
                    style={{ ["--nl-delay" as string]: `${source.delay}ms` }}
                  >
                    {source.label}
                  </text>
                  <path
                    d={d}
                    stroke="#9aa0a8"
                    strokeWidth="1.2"
                    strokeOpacity="0.75"
                    data-draw
                    style={{
                      ["--nl-len" as string]: 320,
                      ["--nl-delay" as string]: `${source.delay + 160}ms`,
                    }}
                  />
                </g>
              );
            })}

            {/* La ligne unique : les trois sources n'en font plus qu'une. */}
            <path
              d={`M${JOIN_X} 100 H${END_X}`}
              stroke="var(--nl-cobalt-bright)"
              strokeWidth="1.8"
              data-draw
              style={{
                ["--nl-len" as string]: 60,
                ["--nl-delay" as string]: `${JOIN_DELAY}ms`,
              }}
            />
            <circle
              cx={END_X}
              cy="100"
              r="4"
              fill="var(--nl-cobalt-bright)"
              data-seq-pop
              style={{ ["--nl-delay" as string]: `${JOIN_DELAY + 260}ms` }}
            />
            <text
              x={END_X + 16}
              y="100"
              dominantBaseline="middle"
              className="fill-[var(--nl-cobalt-bright)] text-[28px] font-semibold sm:text-[22px]"
              data-seq
              style={{ ["--nl-delay" as string]: `${JOIN_DELAY + 320}ms` }}
            >
              Nireo
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
