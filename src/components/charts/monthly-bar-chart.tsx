"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyPoint } from "@/lib/finance";
import { formatCurrencyCompact, formatMonth, formatMonthShort } from "@/lib/format";
import {
  AXIS_TICK,
  BAR_RADIUS,
  BAR_SIZE,
  CHART_CHROME,
  type MonthlySeries,
} from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

// Réexport de compatibilité : préférer l'import depuis chart-theme
// (ce module-ci tire recharts).
export { EXPENSE_SERIES, REVENUE_SERIES, type MonthlySeries } from "./chart-theme";

interface MonthlyBarChartProps {
  data: MonthlyPoint[];
  series: MonthlySeries[];
  height?: number;
}

/** Histogramme mensuel réutilisable (revenus, dépenses, ou les deux). */
export function MonthlyBarChart({ data, series, height = 260 }: MonthlyBarChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthShort}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART_CHROME.baseline, strokeWidth: 1 }}
          />
          <YAxis
            tickFormatter={formatCurrencyCompact}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "rgba(11, 11, 11, 0.04)" }}
            content={<ChartTooltip labelFormatter={formatMonth} />}
          />
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              barSize={BAR_SIZE}
              radius={BAR_RADIUS}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
