"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { NetResultChart } from "@/components/charts/lazy";
import { UpgradeLine } from "@/components/subscription/feature-gate";
import { addMonths, currentMonthKey, lastMonths } from "@/lib/dates";
import { getMonthlySeries, getOccupancyRate } from "@/lib/finance";
import { formatCurrency, formatMonth, formatPercent } from "@/lib/format";
import { getMonthFinancials, percentChange } from "@/lib/insights";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import { hasFeature } from "@/lib/stripe/entitlements";
import type { AppData, ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * STATISTIQUES — le résultat net domine, le reste l'explique.
 *
 * Auparavant : sept cartes géantes de la même taille, dont aucune ne disait
 * quoi faire, puis quatre graphiques dépliés et un tableau. Ici :
 *
 *   titre éditorial → résultat net → revenus / dépenses / occupation sur une
 *   ligne → un graphique compact → ce qui a changé ce mois-ci → accès Pro.
 *
 * Le graphique n'est JAMAIS étiré sur un écran vide : sans donnée, un état
 * vide explique quelle action produira des statistiques.
 */

type Range = 6 | 12;

export default function StatisticsPage() {
  const { data, profile, isLive } = useAppStore();
  const [range, setRange] = React.useState<Range>(6);

  const months = lastMonths(range);
  const window = new Set(months);
  const series = getMonthlySeries(data, range);

  const revenue = data.rentPayments
    .filter((p) => window.has(p.month))
    .reduce((acc, p) => acc + p.received, 0);
  const expenses = data.expenses
    .filter((e) => window.has(e.date.slice(0, 7)))
    .reduce((acc, e) => acc + e.amount, 0);
  const net = revenue - expenses;
  const occupancy = getOccupancyRate(data);

  // Y a-t-il seulement quelque chose à montrer ? Un graphique plat sur douze
  // mois à zéro n'informe personne — il occupe l'écran, c'est tout.
  const hasData = revenue > 0 || expenses > 0;

  const month = currentMonthKey();
  const previousMonth = addMonths(month, -1);
  const current = getMonthFinancials(data, month);
  const previous = getMonthFinancials(data, previousMonth);

  const advanced = isLive
    ? hasFeature(profile?.plan, "advanced_stats")
    : { allowed: true, reason: null };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-9">
      {/* ---------- Titre éditorial ---------- */}
      <header className="space-y-2">
        <p className="text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
          {range === 6 ? "6 derniers mois" : "12 derniers mois"}
        </p>
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-foreground">
          Ce que rapporte votre patrimoine.
        </h1>
      </header>

      {data.properties.length === 0 ? (
        <EmptyStatistics
          title="Vos statistiques arrivent avec votre premier logement."
          description="Nireo calcule vos revenus, vos dépenses et votre résultat à partir des loyers encaissés et des dépenses saisies."
          actionLabel="Ajouter un logement"
          actionHref="/logements/nouveau"
        />
      ) : !hasData ? (
        <EmptyStatistics
          title="Rien à mesurer pour l'instant."
          description="Enregistrez un premier encaissement de loyer, ou une première dépense : le résultat et les graphiques se construiront à partir de là."
          actionLabel="Aller aux loyers"
          actionHref="/loyers"
        />
      ) : (
        <>
          {/* ---------- Résultat net dominant ---------- */}
          <section aria-label="Résultat net" className="space-y-1">
            <p
              className={cn(
                "text-[3rem] leading-none font-semibold tracking-[-0.04em] tabular-nums",
                net >= 0 ? "text-foreground" : "text-danger"
              )}
            >
              {formatCurrency(net)}
            </p>
            <p className="text-sm text-muted-foreground">
              Résultat net — loyers encaissés moins dépenses
            </p>
          </section>

          {/* ---------- Une seule ligne ---------- */}
          <section
            aria-label="Revenus, dépenses et occupation"
            className="flex items-stretch gap-4 border-y border-border py-4"
          >
            <Metric label="Revenus" value={formatCurrency(revenue)} />
            <span aria-hidden className="w-px shrink-0 bg-border" />
            <Metric
              label="Dépenses"
              value={formatCurrency(expenses)}
              tone="expense"
            />
            <span aria-hidden className="w-px shrink-0 bg-border" />
            <Metric label="Occupation" value={formatPercent(occupancy, 0)} />
          </section>

          {/* ---------- Graphique compact + choix de période ---------- */}
          <section aria-labelledby="evolution" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="evolution"
                className="text-lg font-semibold text-foreground"
              >
                Évolution
              </h2>
              <div
                role="radiogroup"
                aria-label="Période"
                className="flex overflow-hidden rounded-lg border border-input"
              >
                {([6, 12] as const).map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={range === value}
                    onClick={() => setRange(value)}
                    className={cn(
                      "min-h-9 px-3 text-sm transition-colors duration-200",
                      index > 0 && "border-l border-input",
                      range === value
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {value} mois
                  </button>
                ))}
              </div>
            </div>
            <NetResultChart data={series} height={200} />
          </section>

          {/* ---------- Ce qui a changé ce mois-ci ---------- */}
          <section aria-labelledby="changements" className="space-y-3">
            <h2 id="changements" className="text-lg font-semibold text-foreground">
              Ce qui a changé ce mois-ci
            </h2>
            <ul className="divide-y divide-border">
              <ChangeRow
                label="Revenus"
                current={current.revenue}
                previous={previous.revenue}
                previousLabel={formatMonth(previousMonth)}
              />
              <ChangeRow
                label="Dépenses"
                current={current.expenses}
                previous={previous.expenses}
                previousLabel={formatMonth(previousMonth)}
                inverted
              />
              <ChangeRow
                label="Résultat"
                current={current.cashflow}
                previous={previous.cashflow}
                previousLabel={formatMonth(previousMonth)}
              />
            </ul>
            <TopExpense data={data} months={window} />
          </section>

          {/* ---------- Accès Pro, discret, tout en bas ---------- */}
          {!advanced.allowed ? (
            <UpgradeLine benefit="Comparez la rentabilité de chaque logement et recevez un rapport mensuel." />
          ) : (
            <PropertyBreakdown data={data} months={window} />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Blocs                                                              */
/* ------------------------------------------------------------------ */

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "expense";
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "truncate text-lg leading-none font-semibold tabular-nums",
          // La couleur chaude est RÉSERVÉE aux dépenses, nulle part ailleurs.
          tone === "expense" ? "text-expense" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="truncate pt-1.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Une variation réelle, ou l'aveu qu'il n'y a rien à comparer. */
function ChangeRow({
  label,
  current,
  previous,
  previousLabel,
  inverted = false,
}: {
  label: string;
  current: number;
  previous: number;
  previousLabel: string;
  /** true : une hausse est une mauvaise nouvelle (dépenses). */
  inverted?: boolean;
}) {
  const delta = percentChange(current, previous);
  const favorable = delta === null ? null : inverted ? delta <= 0 : delta >= 0;
  const flat = delta !== null && Math.abs(delta) < 0.5;

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {formatCurrency(current)} ce mois-ci
        </span>
      </span>
      <span className="shrink-0 text-right">
        {delta === null ? (
          <span className="text-xs text-muted-foreground">
            rien à comparer en {previousLabel.toLowerCase()}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
              flat
                ? "text-muted-foreground"
                : favorable
                  ? "text-success"
                  : "text-danger"
            )}
          >
            {!flat ? (
              delta > 0 ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden />
              )
            ) : null}
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %
          </span>
        )}
      </span>
    </li>
  );
}

/** Le poste de dépense le plus lourd de la période — s'il en existe un. */
function TopExpense({ data, months }: { data: AppData; months: Set<string> }) {
  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of data.expenses) {
    if (!months.has(expense.date.slice(0, 7))) continue;
    byCategory.set(
      expense.category,
      (byCategory.get(expense.category) ?? 0) + expense.amount
    );
  }
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;

  return (
    <p className="text-sm text-muted-foreground">
      Poste le plus lourd sur la période :{" "}
      <span className="font-medium text-foreground">
        {EXPENSE_CATEGORY_LABELS[top[0]]}
      </span>{" "}
      — <span className="tabular-nums text-expense">{formatCurrency(top[1])}</span>.
    </p>
  );
}

/** Bilan par logement (inclus à partir du plan Pro). */
function PropertyBreakdown({
  data,
  months,
}: {
  data: AppData;
  months: Set<string>;
}) {
  const rows = data.properties
    .map((property) => {
      const revenue = data.rentPayments
        .filter((p) => p.propertyId === property.id && months.has(p.month))
        .reduce((acc, p) => acc + p.received, 0);
      const expenses = data.expenses
        .filter(
          (e) => e.propertyId === property.id && months.has(e.date.slice(0, 7))
        )
        .reduce((acc, e) => acc + e.amount, 0);
      return { property, net: revenue - expenses };
    })
    .sort((a, b) => b.net - a.net);

  if (rows.length < 2) return null;

  return (
    <section aria-labelledby="par-logement" className="space-y-3">
      <h2 id="par-logement" className="text-lg font-semibold text-foreground">
        Par logement
      </h2>
      <ul className="divide-y divide-border">
        {rows.map(({ property, net }) => (
          <li key={property.id}>
            <Link
              href={`/logements/${property.id}`}
              className="flex min-h-12 items-center justify-between gap-4 transition-colors duration-200 hover:bg-accent/40"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                {property.name}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  net >= 0 ? "text-success" : "text-danger"
                )}
              >
                {formatCurrency(net)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** État vide : ce qui manque, et l'action exacte qui y remédie. */
function EmptyStatistics({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <section className="space-y-6 py-4">
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"
      >
        <BarChart3 className="size-6" />
      </span>
      <div className="space-y-2">
        <h2 className="text-xl leading-tight font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex min-h-12 items-center gap-2 rounded-[0.625rem] bg-primary px-5 text-[0.95rem] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-95"
      >
        {actionLabel}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
