"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AXIS_TICK,
  BAR_RADIUS,
  BAR_SIZE,
  CHART_CHROME,
  CHART_COLORS,
  LINE_WIDTH,
} from "@/components/charts/chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { getMonthlySeries, type MonthlyPoint } from "@/lib/finance";
import {
  formatCurrencyCompact,
  formatMonth,
  formatMonthShort,
} from "@/lib/format";
import { useAppStore } from "@/lib/store";

type MetricKey = "revenus" | "depenses" | "cashflow" | "resultat";
type PeriodKey = "3m" | "6m" | "12m" | "ytd";

interface MetricConfig {
  key: MetricKey;
  label: string;
  description: string;
  color: string;
  mark: "bar" | "line";
}

const METRICS: MetricConfig[] = [
  {
    key: "revenus",
    label: "Revenus",
    description: "Loyers encaissés par mois",
    color: CHART_COLORS.revenue,
    mark: "bar",
  },
  {
    key: "depenses",
    label: "Dépenses",
    description: "Charges, taxes et travaux par mois",
    color: CHART_COLORS.expense,
    mark: "bar",
  },
  {
    key: "cashflow",
    label: "Cash-flow",
    description: "Revenus − dépenses, mois par mois",
    color: CHART_COLORS.aqua,
    mark: "line",
  },
  {
    key: "resultat",
    label: "Résultat net",
    description: "Résultat cumulé sur la période",
    color: CHART_COLORS.violet,
    mark: "line",
  },
];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "3m", label: "3 mois" },
  { key: "6m", label: "6 mois" },
  { key: "12m", label: "12 mois" },
  { key: "ytd", label: "Année en cours" },
];

function monthsFor(period: PeriodKey): number {
  if (period === "3m") return 3;
  if (period === "6m") return 6;
  if (period === "12m") return 12;
  // Année en cours : de janvier au mois courant.
  return new Date().getMonth() + 1;
}

interface ChartPoint {
  month: string;
  valeur: number;
}

function buildPoints(monthly: MonthlyPoint[], metric: MetricKey): ChartPoint[] {
  let cumulative = 0;
  return monthly.map((point) => {
    const net = point.revenus - point.depenses;
    cumulative += net;
    const valeur =
      metric === "revenus"
        ? point.revenus
        : metric === "depenses"
          ? point.depenses
          : metric === "cashflow"
            ? net
            : cumulative;
    return { month: point.month, valeur };
  });
}

/** Graphique principal du cockpit : métrique et période commutables. */
export function MainChart() {
  const { data } = useAppStore();
  const [metric, setMetric] = React.useState<MetricKey>("revenus");
  const [period, setPeriod] = React.useState<PeriodKey>("12m");

  const config = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const monthly = getMonthlySeries(data, monthsFor(period));
  const points = buildPoints(monthly, metric);
  const hasNegative = points.some((p) => p.valeur < 0);

  const axisProps = {
    x: {
      dataKey: "month",
      tickFormatter: formatMonthShort,
      tick: AXIS_TICK,
      tickLine: false,
      axisLine: { stroke: CHART_CHROME.baseline, strokeWidth: 1 },
    },
    y: {
      tickFormatter: formatCurrencyCompact,
      tick: AXIS_TICK,
      tickLine: false,
      axisLine: false,
      width: 64,
    },
  } as const;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              Performance financière
            </CardTitle>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Métrique affichée"
          >
            {METRICS.map((m) => (
              <Button
                key={m.key}
                size="xs"
                variant="ghost"
                aria-pressed={metric === m.key}
                className={
                  metric === m.key
                    ? "bg-background text-foreground shadow-xs hover:bg-background"
                    : "text-muted-foreground"
                }
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Période affichée"
        >
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="xs"
              variant={period === p.key ? "secondary" : "ghost"}
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* La clé force une légère ré-apparition au changement de vue. */}
        <div key={`${metric}-${period}`} className="animate-panel-in h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {config.mark === "bar" ? (
              <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />
                <XAxis {...axisProps.x} />
                <YAxis {...axisProps.y} />
                <Tooltip
                  cursor={{ fill: "rgba(11, 11, 11, 0.04)" }}
                  content={<ChartTooltip labelFormatter={formatMonth} />}
                />
                <Bar
                  dataKey="valeur"
                  name={config.label}
                  fill={config.color}
                  barSize={BAR_SIZE}
                  radius={BAR_RADIUS}
                />
              </BarChart>
            ) : (
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />
                <XAxis {...axisProps.x} />
                <YAxis {...axisProps.y} />
                {hasNegative ? (
                  <ReferenceLine y={0} stroke={CHART_CHROME.baseline} strokeWidth={1} />
                ) : null}
                <Tooltip content={<ChartTooltip labelFormatter={formatMonth} />} />
                <Line
                  dataKey="valeur"
                  name={config.label}
                  stroke={config.color}
                  strokeWidth={LINE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
