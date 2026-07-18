import { Check, Minus } from "lucide-react";
import { PLANS, planHasFeature, type FeatureId } from "@/config/plans";
import { cn } from "@/lib/utils";

/**
 * Comparaison des plans — uniquement des fonctions réelles, dérivées de
 * src/config/plans.ts (aucune limite dupliquée à la main).
 * Desktop : tableau. Mobile : cartes par plan (aucun tableau coupé).
 */

type CellValue = string | boolean;

interface ComparisonRow {
  label: string;
  values: CellValue[]; // dans l'ordre de PLANS
}

const countLabel = (n: number | null) => (n === null ? "Illimité" : String(n));
const storageLabel = (mb: number) => (mb >= 1024 ? `${mb / 1024} Go` : `${mb} Mo`);
const featureRow = (label: string, feature: FeatureId): ComparisonRow => ({
  label,
  values: PLANS.map((p) => planHasFeature(p.id, feature)),
});

const ROWS: ComparisonRow[] = [
  { label: "Logements", values: PLANS.map((p) => countLabel(p.limits.maxProperties)) },
  {
    label: "Locataires actifs",
    values: PLANS.map((p) =>
      p.limits.maxActiveTenants === null ? "1 par logement" : String(p.limits.maxActiveTenants)
    ),
  },
  { label: "Baux, loyers, dépenses, travaux", values: PLANS.map(() => true) },
  { label: "Documents", values: PLANS.map((p) => countLabel(p.limits.maxDocuments)) },
  { label: "Photos", values: PLANS.map((p) => countLabel(p.limits.maxPhotos)) },
  { label: "Stockage", values: PLANS.map((p) => storageLabel(p.limits.storageMb)) },
  featureRow("Relances manuelles par e-mail", "manual_reminders"),
  featureRow("Relances automatiques", "auto_reminders"),
  featureRow("Exports (JSON, CSV)", "simple_exports"),
  featureRow("Statistiques avancées", "advanced_stats"),
  featureRow("Rapport mensuel par e-mail", "monthly_reports"),
  featureRow("Carte du patrimoine", "patrimony_map"),
  featureRow("Centre de pilotage Premium", "command_center"),
  {
    label: "Support",
    values: PLANS.map((p) =>
      planHasFeature(p.id, "priority_support") ? "Prioritaire" : "Standard"
    ),
  },
];

function Cell({ value }: { value: CellValue }) {
  if (value === true) {
    return <Check className="mx-auto size-4 text-primary" aria-label="Inclus" />;
  }
  if (value === false) {
    return <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Non inclus" />;
  }
  return <span className="text-foreground">{value}</span>;
}

export function PlanComparison() {
  return (
    <div>
      <h3 className="mb-4 text-center text-lg font-semibold tracking-tight text-foreground">
        Comparer les plans en détail
      </h3>

      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Fonction
              </th>
              {PLANS.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-center font-medium",
                    plan.popular ? "text-primary" : "text-foreground"
                  )}
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-4 py-3 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td key={PLANS[i].id} className="px-4 py-3 text-center tabular-nums">
                    <Cell value={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : une carte par plan */}
      <div className="space-y-3 md:hidden">
        {PLANS.map((plan, planIndex) => (
          <details
            key={plan.id}
            className="group rounded-xl border border-border bg-card px-4"
            open={plan.popular}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {plan.name}
              <span className="text-xs text-muted-foreground">
                {plan.monthlyPrice.toLocaleString("fr-FR", {
                  minimumFractionDigits: plan.monthlyPrice % 1 === 0 ? 0 : 2,
                })}{" "}
                €/mois
              </span>
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {ROWS.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <Cell value={row.values[planIndex]} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
