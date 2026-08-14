import { getPlan } from "@/config/plans";

/**
 * Section « Sécurité » (#securite) — trois preuves, reliées par un filet.
 *
 * RÈGLE DE CONTENU : rien n'est promis ici qui ne soit déjà vrai et déjà
 * écrit ailleurs dans le projet.
 *
 * - l'isolement par compte est appliqué PAR LA BASE (politiques RLS,
 *   vérifiées par `scripts/rls-test.mjs` et `scripts/cross-owner-test.mjs`) ;
 * - l'hébergement européen est ce que la FAQ de la vitrine affirme déjà
 *   (`src/components/marketing/faq-section.tsx`, entrée « securite ») ;
 * - l'export dépend du plan : le nom du plan concerné est LU dans
 *   `src/config/plans.ts` (fonctionnalité `simple_exports`), jamais recopié.
 *
 * Aucune certification, aucun chiffrement « de bout en bout », aucun label :
 * ce qui n'est pas vérifiable n'est pas écrit.
 */

/** Premier plan qui ouvre les exports — source de vérité : config/plans.ts. */
const EXPORT_PLAN = getPlan("starter");

const PROOFS = [
  {
    title: "Vos données sont isolées",
    text: "Un compte ne peut lire que ses propres logements, baux et documents. L’isolement est appliqué par la base de données, pas seulement par l’interface.",
  },
  {
    title: "Hébergement européen",
    text: "Vos données et vos fichiers sont hébergés en Europe. Les documents et les photos vivent dans un espace privé, servi par des liens signés à durée limitée.",
  },
  {
    title: "Vos données restent les vôtres",
    text: `À partir du plan ${EXPORT_PLAN.name}, vous téléchargez quand vous voulez un export complet (JSON) et un export CSV de vos loyers. La suppression du compte efface tout, définitivement.`,
  },
];

export function SecuritySection() {
  return (
    // Bleu profond : c'est ce qui fait la TRANSITION entre la section noire
    // qui précède et le papier qui suit, plutôt qu'une arête entre deux
    // aplats opposés. Le dégradé de bas de section (`nl-fade-to-paper`)
    // termine le passage.
    <section
      id="securite"
      data-lx-section="security"
      className="nl-fade-to-paper relative bg-[var(--nl-deep)] pt-16 pb-24 text-white sm:pt-24 sm:pb-32"
    >
      <div data-reveal className="nl-seq mx-auto w-full max-w-[82rem] px-6 sm:px-8">
        <p
          data-seq
          className="flex items-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-white/75 sm:text-[0.78rem]"
        >
          <span
            aria-hidden
            data-seq-rule
            style={{ ["--nl-delay" as string]: "120ms", ["--nl-dur" as string]: "0.5s" }}
            className="h-px w-8 bg-[var(--nl-cobalt-bright)]"
          />
          SÉCURITÉ
        </p>

        <h2 className="mt-6 max-w-[26em] text-[clamp(1.85rem,5.6vw,3rem)] font-semibold">
          <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
            <span>
              Vos données ne sont{" "}
              <span data-sweep style={{ ["--nl-delay" as string]: "480ms" }}>
                jamais mélangées
              </span>
              .
            </span>
          </span>
        </h2>

        {/* Trois preuves sur un même filet : vertical tant que la colonne est
            unique, horizontal dès que les trois tiennent côte à côte. Deux
            éléments distincts plutôt qu'un seul, parce qu'un tracé vertical
            et un tracé horizontal ne se dessinent pas dans le même sens. */}
        <div className="nl-proofs relative mt-12 grid grid-cols-1 md:grid-cols-3">
          {/* Le filet horizontal des grands écrans : du premier point au
              dernier, jamais au-delà. */}
          <span
            aria-hidden
            data-seq-rule
            style={{ ["--nl-delay" as string]: "340ms", ["--nl-dur" as string]: "0.9s" }}
            className="nl-proofs-rule hidden md:block"
          />

          {PROOFS.map((proof, index) => {
            const delay = 420 + index * 220;
            return (
              <div key={proof.title} className="nl-proof">
                <span
                  aria-hidden
                  data-seq-pop
                  style={{ ["--nl-delay" as string]: `${delay}ms` }}
                  className="nl-proof-dot"
                />
                {/* En colonne unique, chaque preuve porte le segment qui la
                    relie à la suivante — le tracé descend au lieu d'avancer. */}
                {index < PROOFS.length - 1 ? (
                  <span
                    aria-hidden
                    data-seq-thread
                    style={{
                      ["--nl-delay" as string]: `${delay + 100}ms`,
                      ["--nl-dur" as string]: "0.4s",
                    }}
                    className="nl-proof-link md:hidden"
                  />
                ) : null}
                <div data-seq style={{ ["--nl-delay" as string]: `${delay}ms` }}>
                  <h3 className="text-[1.05rem] font-semibold">{proof.title}</h3>
                  <p className="mt-2 max-w-[30rem] text-[0.95rem] leading-relaxed text-white/78">
                    {proof.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
