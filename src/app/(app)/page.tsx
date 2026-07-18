"use client";

import {
  AlertTriangle,
  Building2,
  Landmark,
  ListTodo,
  Percent,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { ActionCenter } from "@/components/dashboard/action-center";
import { AddMenu } from "@/components/dashboard/add-menu";
import { DocumentsPreview } from "@/components/dashboard/documents-preview";
import dynamic from "next/dynamic";
import { HealthScore } from "@/components/dashboard/health-score";
import { PriorityProperties } from "@/components/dashboard/priority-properties";
import { Skeleton } from "@/components/ui/skeleton";

// Le graphique principal (recharts) sort du bundle initial du dashboard.
const MainChart = dynamic(
  () => import("@/components/dashboard/main-chart").then((m) => m.MainChart),
  { ssr: false, loading: () => <Skeleton className="h-90 w-full rounded-xl" /> }
);
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TodayPanel } from "@/components/dashboard/today-panel";
import { WorksPreview } from "@/components/dashboard/works-preview";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, type StatTrend } from "@/components/shared/stat-card";
import { addMonths, currentMonthKey } from "@/lib/dates";
import { getOccupancyRate } from "@/lib/finance";
import {
  getActionItems,
  getAverageGrossYield,
  getHealthReport,
  getMonthFinancials,
  getPortfolioValue,
  getPriorityProperties,
  percentChange,
} from "@/lib/insights";
import {
  formatCurrency,
  formatDateLong,
  formatDelta,
  formatMonthShort,
  formatPercent,
} from "@/lib/format";
import { useAppStore } from "@/lib/store";

/** Tendance mensuelle d'un indicateur (inverted : une hausse est défavorable). */
function monthTrend(
  current: number,
  previous: number,
  previousLabel: string,
  inverted = false
): StatTrend | undefined {
  const delta = percentChange(current, previous);
  if (delta === null) return undefined;
  const direction = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const favorable = inverted ? delta <= 0 : delta >= 0;
  return {
    direction,
    label: `${formatDelta(delta)} vs ${previousLabel}`,
    tone: direction === "flat" ? "neutral" : favorable ? "positive" : "negative",
  };
}

export default function DashboardPage() {
  const { data, profile } = useAppStore();

  const month = currentMonthKey();
  const previousMonth = addMonths(month, -1);
  const previousLabel = formatMonthShort(previousMonth);

  const current = getMonthFinancials(data, month);
  const previous = getMonthFinancials(data, previousMonth);
  const health = getHealthReport(data);
  const actions = getActionItems(data);
  const priorities = getPriorityProperties(data);
  const occupancy = getOccupancyRate(data);
  const lateCount = data.rentPayments.filter((p) => p.status === "retard").length;

  // Loyers du mois : attendus vs encaissés (données réelles uniquement).
  const monthPayments = data.rentPayments.filter((p) => p.month === month);
  const expectedRent = monthPayments.reduce((acc, p) => acc + p.expected, 0);
  const receivedRent = monthPayments.reduce((acc, p) => acc + p.received, 0);
  const occupied = data.properties.filter((p) => p.status === "loue").length;
  const vacant = data.properties.filter((p) => p.status === "vacant").length;

  const firstName = profile?.fullName?.split(" ")[0];

  // Synthèse en une phrase, dérivée des données.
  const synthesis =
    actions.length === 0
      ? "Votre patrimoine se porte bien. Tous les indicateurs sont au vert, rien ne demande votre attention aujourd'hui."
      : lateCount > 0
        ? `${lateCount} loyer${lateCount > 1 ? "s" : ""} en retard et ${actions.length} action${actions.length > 1 ? "s" : ""} à traiter aujourd'hui.`
        : `Votre patrimoine se porte ${health.score >= 75 ? "bien" : "correctement"}. ${actions.length} action${actions.length > 1 ? "s" : ""} demande${actions.length > 1 ? "nt" : ""} votre attention.`;

  return (
    <>
      <PageHeader
        eyebrow={
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formatDateLong(new Date())}
          </p>
        }
        title={firstName ? `Bonjour ${firstName}` : "Tableau de bord"}
        description={synthesis}
      >
        <AddMenu />
      </PageHeader>

      <section aria-label="Santé du patrimoine">
        <HealthScore report={health} />
      </section>

      {/* Indicateurs clés */}
      <section
        aria-label="Indicateurs clés"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Valeur du patrimoine"
          value={formatCurrency(getPortfolioValue(data))}
          hint="prix d'acquisition cumulés"
          icon={Landmark}
          href="/logements"
        />
        <StatCard
          label="Revenus du mois"
          value={formatCurrency(current.revenue)}
          icon={TrendingUp}
          trend={monthTrend(current.revenue, previous.revenue, previousLabel)}
          href="/loyers"
        />
        <StatCard
          label="Dépenses du mois"
          value={formatCurrency(current.expenses)}
          icon={Receipt}
          trend={monthTrend(current.expenses, previous.expenses, previousLabel, true)}
          href="/statistiques"
        />
        <StatCard
          label="Cash-flow du mois"
          value={formatCurrency(current.cashflow)}
          icon={PiggyBank}
          tone={current.cashflow >= 0 ? "positive" : "negative"}
          trend={monthTrend(current.cashflow, previous.cashflow, previousLabel)}
          href="/statistiques"
        />
        <StatCard
          label="Rentabilité moyenne"
          value={formatPercent(getAverageGrossYield(data))}
          hint="rendement brut du parc"
          icon={Percent}
          href="/statistiques"
        />
        <StatCard
          label="Taux d'occupation"
          value={formatPercent(occupancy, 0)}
          icon={Building2}
          progress={occupancy}
          hint={`${occupied} occupé${occupied > 1 ? "s" : ""} · ${vacant} vacant${vacant > 1 ? "s" : ""}`}
          href="/logements"
        />
        <StatCard
          label="Loyers en retard"
          value={String(lateCount)}
          icon={AlertTriangle}
          tone={lateCount > 0 ? "warning" : "default"}
          hint={lateCount === 0 ? "aucun impayé en cours" : "à relancer rapidement"}
          href="/loyers"
        />
        <StatCard
          label="Loyers du mois"
          value={`${formatCurrency(receivedRent)} / ${formatCurrency(expectedRent)}`}
          icon={ListTodo}
          hint="encaissés / attendus"
          progress={expectedRent > 0 ? (receivedRent * 100) / expectedRent : undefined}
          href="/loyers"
        />
      </section>

      {/* Aujourd'hui + actions à traiter */}
      <section
        aria-label="Aujourd'hui et actions à traiter"
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
      >
        <TodayPanel data={data} />
        <div className="xl:col-span-2">
          <ActionCenter items={actions} />
        </div>
      </section>

      {/* Performance + suivis compacts */}
      <section
        aria-label="Performance et suivis"
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
      >
        <div className="xl:col-span-2">
          <MainChart />
        </div>
        <div className="space-y-4">
          <WorksPreview />
          <DocumentsPreview />
        </div>
      </section>

      <PriorityProperties entries={priorities} />

      {/* Activité + raccourcis */}
      <section
        aria-label="Activité récente et raccourcis"
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
      >
        <div className="xl:col-span-2">
          <RecentActivity items={data.activity} limit={7} />
        </div>
        <QuickActions />
      </section>
    </>
  );
}
