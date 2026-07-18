"use client";

import Link from "next/link";
import { Percent, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartLegend } from "@/components/charts/chart-tooltip";
import { EXPENSE_SERIES, REVENUE_SERIES } from "@/components/charts/chart-theme";
import {
  MonthlyBarChart,
  NetResultChart,
  RevenueByPropertyChart,
} from "@/components/charts/lazy";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { RentStatusBadge } from "@/components/shared/status-badge";
import { FeatureGate } from "@/components/subscription/feature-gate";
import { lastMonths } from "@/lib/dates";
import {
  getDashboardStats,
  getMonthlySeries,
  getOccupancyRate,
  getRevenueByProperty,
} from "@/lib/finance";
import { getAverageGrossYield } from "@/lib/insights";
import { formatCurrency, formatPercent } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function StatisticsPage() {
  const { data } = useAppStore();
  const stats = getDashboardStats(data);
  const monthly = getMonthlySeries(data, 12);
  const byProperty = getRevenueByProperty(data).map((entry) => ({
    name: entry.property.name,
    revenus: entry.revenue,
  }));

  const window = new Set(lastMonths(12));

  // Rentabilité par logement sur 12 mois glissants.
  const propertyRows = data.properties
    .map((property) => {
      const revenue = data.rentPayments
        .filter((p) => p.propertyId === property.id && window.has(p.month))
        .reduce((acc, p) => acc + p.received, 0);
      const expenses = data.expenses
        .filter((e) => e.propertyId === property.id && window.has(e.date.slice(0, 7)))
        .reduce((acc, e) => acc + e.amount, 0);
      return {
        property,
        revenue,
        expenses,
        net: revenue - expenses,
        grossYield:
          property.purchasePrice > 0
            ? (property.rent * 12 * 100) / property.purchasePrice
            : 0,
      };
    })
    .sort((a, b) => b.net - a.net);

  // Répartition des dépenses par catégorie sur 12 mois glissants.
  const windowExpenses = data.expenses.filter((e) => window.has(e.date.slice(0, 7)));
  const totalWindowExpenses = windowExpenses.reduce((acc, e) => acc + e.amount, 0);
  const expenseBreakdown = (
    Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
  )
    .map((category) => ({
      category,
      amount: windowExpenses
        .filter((e) => e.category === category)
        .reduce((acc, e) => acc + e.amount, 0),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // Évolution annuelle : revenus de l'année en cours vs année précédente
  // (même périmètre calendaire, uniquement des paiements réels).
  const currentYear = String(new Date().getFullYear());
  const previousYear = String(new Date().getFullYear() - 1);
  const revenueOfYear = (year: string) =>
    data.rentPayments
      .filter((p) => p.month.startsWith(year))
      .reduce((acc, p) => acc + p.received, 0);
  const previousYearRevenue = revenueOfYear(previousYear);
  const yearDelta =
    previousYearRevenue > 0
      ? ((revenueOfYear(currentYear) - previousYearRevenue) * 100) / previousYearRevenue
      : null;

  // Santé des encaissements sur 12 mois glissants.
  const windowPayments = data.rentPayments.filter((p) => window.has(p.month));
  const expected = windowPayments.reduce((acc, p) => acc + p.expected, 0);
  const received = windowPayments.reduce((acc, p) => acc + p.received, 0);
  const collectionRate = expected > 0 ? (received * 100) / expected : 0;
  const problemPayments = windowPayments
    .filter((p) => p.status === "retard" || p.status === "partiel")
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title="Statistiques"
        description="Analyse financière de votre patrimoine sur 12 mois"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenus (année en cours)"
          value={formatCurrency(stats.yearRevenue)}
          icon={TrendingUp}
        />
        <StatCard
          label="Dépenses (année en cours)"
          value={formatCurrency(stats.yearExpenses)}
          icon={Receipt}
          tone="negative"
        />
        <StatCard
          label="Résultat net"
          value={formatCurrency(stats.yearNet)}
          icon={PiggyBank}
          tone={stats.yearNet >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Taux d'occupation"
          value={formatPercent(getOccupancyRate(data), 0)}
          icon={Percent}
          progress={getOccupancyRate(data)}
        />
        <StatCard
          label="Taux d'encaissement (12 mois)"
          value={formatPercent(collectionRate)}
          icon={PiggyBank}
          progress={collectionRate}
          tone={collectionRate >= 95 ? "positive" : "warning"}
        />
        <StatCard
          label="Rendement brut moyen"
          value={formatPercent(getAverageGrossYield(data))}
          hint="loyers annuels / prix d'acquisition"
          icon={Percent}
        />
        <StatCard
          label={`Évolution vs ${previousYear}`}
          value={yearDelta === null ? "—" : `${yearDelta >= 0 ? "+" : ""}${yearDelta.toFixed(1)} %`}
          hint={
            yearDelta === null
              ? `aucun revenu enregistré en ${previousYear}`
              : "revenus encaissés, année civile"
          }
          icon={TrendingUp}
          tone={yearDelta === null ? "default" : yearDelta >= 0 ? "positive" : "negative"}
        />
      </div>

      <ChartCard
        title="Revenus et dépenses"
        description="Comparaison mensuelle sur les 12 derniers mois"
        toolbar={
          <ChartLegend
            items={[
              { label: REVENUE_SERIES.name, color: REVENUE_SERIES.color },
              { label: EXPENSE_SERIES.name, color: EXPENSE_SERIES.color },
            ]}
          />
        }
      >
        <MonthlyBarChart
          data={monthly}
          series={[REVENUE_SERIES, EXPENSE_SERIES]}
          height={300}
        />
      </ChartCard>

      {/* Statistiques avancées : incluses à partir du plan Pro. */}
      <FeatureGate feature="advanced_stats" title="Statistiques avancées">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Rentabilité mensuelle"
          description="Résultat net (revenus − dépenses) par mois"
        >
          <NetResultChart data={monthly} />
        </ChartCard>

        <ChartCard
          title="Revenus par logement"
          description="Loyers encaissés sur les 12 derniers mois"
        >
          <RevenueByPropertyChart data={byProperty} />
        </ChartCard>
      </div>

      {/* Ce qui rapporte, ce qui coûte : bilan par logement */}
      {propertyRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Rentabilité par logement
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Sur les 12 derniers mois — du plus rentable au moins rentable.
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Logement</TableHead>
                    <TableHead className="text-right">Revenus</TableHead>
                    <TableHead className="text-right">Dépenses</TableHead>
                    <TableHead className="text-right">Résultat</TableHead>
                    <TableHead className="pr-4 text-right">Rendement brut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyRows.map((row, index) => (
                    <TableRow key={row.property.id}>
                      <TableCell className="pl-4 font-medium">
                        <Link
                          href={`/logements/${row.property.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {row.property.name}
                        </Link>
                        {index === 0 && row.net > 0 ? (
                          <span className="ml-2 rounded-full bg-emerald-500/10 px-1.5 py-px text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            Le plus rentable
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.expenses)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          row.net >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        )}
                      >
                        {formatCurrency(row.net)}
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">
                        {formatPercent(row.grossYield)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Répartition des dépenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Répartition des dépenses
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Par catégorie, sur les 12 derniers mois.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune dépense enregistrée sur la période.
              </p>
            ) : (
              expenseBreakdown.map((entry) => (
                <div key={entry.category} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(entry.amount)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {formatPercent((entry.amount * 100) / totalWindowExpenses, 0)}
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={(entry.amount * 100) / totalWindowExpenses}
                    aria-label={EXPENSE_CATEGORY_LABELS[entry.category]}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Santé des encaissements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Santé des encaissements
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Loyers perçus par rapport aux loyers attendus sur 12 mois.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Taux d&apos;encaissement</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatPercent(collectionRate)}
                </span>
              </div>
              <Progress
                value={collectionRate}
                indicatorClassName={
                  collectionRate >= 95 ? "bg-emerald-600" : "bg-amber-500"
                }
                aria-label="Taux d'encaissement"
              />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(received)} encaissés sur {formatCurrency(expected)}{" "}
                attendus.
              </p>
            </div>

            {problemPayments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Paiements à surveiller
                </p>
                <ul className="divide-y divide-border">
                  {problemPayments.map((payment) => {
                    const property = data.properties.find(
                      (p) => p.id === payment.propertyId
                    );
                    return (
                      <li
                        key={payment.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm text-foreground">
                          {property?.name ?? "Logement"}
                          <span className="text-muted-foreground">
                            {" "}
                            · reste{" "}
                            {formatCurrency(payment.expected - payment.received)}
                          </span>
                        </span>
                        <RentStatusBadge status={payment.status} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Aucun retard ni paiement partiel sur la période. Excellent.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      </FeatureGate>
    </>
  );
}
