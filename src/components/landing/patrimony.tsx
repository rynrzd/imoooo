import { Check } from "lucide-react";
import { PropertyScreen } from "@/components/landing/nireo-screen";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * « Tout votre patrimoine. Un seul endroit. »
 *
 * Composition autour d'UN logement sélectionné : son dossier au centre, et
 * de part et d'autre ce qui lui est rattaché, relié par un filet. Ni sept
 * cartes identiques, ni grille de vignettes — un plan, avec un axe.
 *
 * Sur mobile, la composition se replie en une seule colonne : le dossier,
 * puis la liste sur un rail vertical. Rien n'est coupé, rien ne déborde.
 */

const LEFT = [
  { label: "Logements", detail: "Surface, statut, loyer, rendement" },
  { label: "Locataires", detail: "Contact et bail rattachés au logement" },
  { label: "Baux", detail: "Loyer, charges, dépôt, entrée et sortie" },
];

const RIGHT = [
  { label: "Loyers", detail: "Échéances du mois, encaissements, retards" },
  { label: "Documents et photos", detail: "Baux, diagnostics, factures, états des lieux" },
  { label: "Dépenses et travaux", detail: "Catégories, justificatifs, chantiers" },
  { label: "Statistiques", detail: "Revenus, dépenses, résultat net, rentabilité" },
];

function Row({
  label,
  detail,
  side,
}: {
  label: string;
  detail: string;
  /** Le filet part vers le centre de la composition. */
  side: "left" | "right";
}) {
  return (
    <li className="relative py-3.5 max-lg:pl-6">
      {/* Rail vertical (mobile) + son point d'ancrage sur chaque rubrique. */}
      <span aria-hidden className="absolute top-0 left-0 h-full w-px bg-border lg:hidden" />
      <span aria-hidden className="absolute top-6 left-0 h-px w-4 bg-[var(--land-stone)] lg:hidden" />
      <div className={cn("lg:flex lg:items-baseline lg:gap-3", side === "left" && "lg:justify-end")}>
        <div className={cn(side === "left" ? "lg:text-right" : "lg:order-2")}>
          <p className="text-[0.95rem] font-medium text-foreground">{label}</p>
          <p className="mt-1 text-[0.82rem] leading-snug text-muted-foreground">{detail}</p>
        </div>
        {/* Filet de liaison vers le dossier (ordinateur uniquement). */}
        <span
          aria-hidden
          className={cn(
            "mt-2.5 hidden h-px shrink-0 bg-[var(--land-stone)] lg:block lg:w-8 xl:w-12",
            side === "right" && "lg:order-1"
          )}
        />
      </div>
    </li>
  );
}

export function Patrimony() {
  return (
    <div>
      <Reveal className="max-w-2xl">
        <p className="land-eyebrow text-muted-foreground">Centralisation</p>
        <h2 className="mt-4 text-[1.9rem] font-semibold text-balance text-foreground sm:text-[2.5rem]">
          Tout votre patrimoine. Un seul endroit.
        </h2>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-muted-foreground">
          Vous ouvrez un logement, et tout ce qui le concerne est déjà là. Rien à
          chercher ailleurs, rien à recopier d’un outil à l’autre.
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 items-center gap-8 sm:mt-14 lg:grid-cols-[1fr_minmax(0,26rem)_1fr] lg:gap-4">
        <ul className="order-2 divide-y divide-border lg:order-1">
          {LEFT.map((item) => (
            <Row key={item.label} {...item} side="left" />
          ))}
        </ul>

        <Reveal className="order-1 lg:order-2">
          <PropertyScreen />
          <p className="mt-3 text-center text-[0.78rem] text-muted-foreground">
            Un logement sélectionné — et tout ce qui lui est rattaché.
          </p>
        </Reveal>

        <ul className="order-3 divide-y divide-border">
          {RIGHT.map((item) => (
            <Row key={item.label} {...item} side="right" />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Avant / avec                                                      */
/* ------------------------------------------------------------------ */

/**
 * Le même mois, vu deux fois. À gauche, des pièces éparpillées et de travers ;
 * à droite, une seule liste alignée. La comparaison se lit entièrement sans
 * animation : rien n'est révélé au défilement, seule l'apparition est douce.
 */

const BEFORE = [
  { text: "Loyers_2026.xlsx", meta: "3 versions, laquelle est la bonne ?", tilt: "-rotate-[1.4deg]" },
  { text: "Re : bail à signer", meta: "quelque part dans la boîte mail", tilt: "rotate-[1deg]" },
  { text: "Dossier « Appartements »", meta: "sous-dossiers par année", tilt: "-rotate-[0.6deg]" },
  { text: "Attestation d’assurance", meta: "introuvable", tilt: "rotate-[1.6deg]" },
  { text: "Rentabilité", meta: "recalculée à la main, chaque année", tilt: "-rotate-[1.1deg]" },
];

const AFTER = [
  "Un seul espace, ouvert sur le mois en cours",
  "Chaque logement possède son dossier",
  "Loyers attendus, encaissés et en retard, d’un coup d’œil",
  "Documents et photos rattachés au bon logement",
  "Chiffres reliés aux dépenses et aux travaux",
];

export function BeforeAfter() {
  return (
    <div>
      <Reveal className="max-w-2xl">
        <p className="land-eyebrow text-muted-foreground">La différence</p>
        <h2 className="mt-4 text-[1.9rem] font-semibold text-balance text-foreground sm:text-[2.5rem]">
          Le même mois, vu deux fois.
        </h2>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:mt-12 lg:grid-cols-2 lg:gap-14">
        {/* ---- Avant ---- */}
        <Reveal>
          <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Avant Nireo
          </p>
          <div className="mt-5 space-y-2.5">
            {BEFORE.map((item, i) => (
              <div
                key={item.text}
                style={{ marginLeft: `${(i % 3) * 10}px` }}
                className={cn(
                  "max-w-[22rem] rounded-[4px] border border-border bg-[color-mix(in_srgb,var(--land-stone)_16%,var(--land-paper))] px-3.5 py-2.5",
                  item.tilt
                )}
              >
                <p className="text-[0.88rem] font-medium text-foreground">{item.text}</p>
                <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{item.meta}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ---- Avec ---- */}
        <Reveal delay={90}>
          <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-primary uppercase">
            Avec Nireo
          </p>
          <ul className="mt-5 border-l-2 border-primary pl-5 sm:pl-6">
            {AFTER.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 border-b border-border py-3.5 text-[0.95rem] text-foreground last:border-b-0"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--land-green)]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
