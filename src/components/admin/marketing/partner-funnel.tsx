import { ChevronRight } from "lucide-react";

/**
 * L'affiliation racontée dans son ordre réel :
 * partage → inscription → abonnement → commission.
 *
 * La version précédente alignait quatre chiffres sans lien entre eux. Or ce
 * qui intéresse n'est pas « 500 clics » dans l'absolu, c'est ce qui SURVIT
 * d'une étape à la suivante : 500 clics pour deux inscriptions et 5 clics
 * pour deux inscriptions ne décrivent pas le même partenaire.
 *
 * Le taux affiché sous chaque étape est celui de la marche précédente vers
 * celle-ci. Quand l'étape d'avant est à zéro, aucun taux n'est affiché —
 * une division par zéro ne devient pas « 0 % », qui laisserait croire à un
 * échec là où il n'y a simplement rien eu.
 */

interface Step {
  label: string;
  value: string;
  /** Valeur brute servant au calcul du taux (les euros n'en ont pas). */
  count: number | null;
  hint: string;
}

function rate(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const percent = (current / previous) * 100;
  return `${percent.toFixed(percent < 10 ? 1 : 0).replace(".", ",")} % de l’étape précédente`;
}

export function PartnerFunnel({
  clicks,
  signups,
  conversions,
  earnedLabel,
}: {
  clicks: number;
  signups: number;
  conversions: number;
  /** Commissions générées depuis le début, déjà formatées en euros. */
  earnedLabel: string;
}) {
  const steps: Step[] = [
    {
      label: "Partage",
      value: String(clicks),
      count: clicks,
      hint: clicks > 1 ? "visites via le lien" : "visite via le lien",
    },
    {
      label: "Inscription",
      value: String(signups),
      count: signups,
      hint: rate(signups, clicks) ?? "compte créé et attribué",
    },
    {
      label: "Abonnement",
      value: String(conversions),
      count: conversions,
      hint: rate(conversions, signups) ?? "a payé au moins une fois",
    },
    {
      label: "Commission",
      value: earnedLabel,
      count: null,
      hint: "généré depuis le début",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Du partage à la commission</h2>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex items-start gap-2">
            {/* Le chevron matérialise l'enchaînement. Il disparaît quand les
                étapes s'empilent : une flèche horizontale entre deux blocs
                superposés désignerait le vide. */}
            {index > 0 ? (
              <ChevronRight
                aria-hidden
                className="mt-3.5 hidden size-4 shrink-0 text-muted-foreground/40 lg:block"
              />
            ) : null}
            <div className="min-w-0 flex-1 rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                {index + 1}. {step.label}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                {step.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
