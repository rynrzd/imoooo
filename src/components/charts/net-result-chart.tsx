"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyPoint } from "@/lib/finance";
import { formatCurrencyCompact, formatMonth, formatMonthShort } from "@/lib/format";
import { AXIS_TICK, CHART_CHROME, CHART_COLORS, LINE_WIDTH } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

interface NetResultChartProps {
  data: MonthlyPoint[];
  height?: number;
}

/** Résultat net mensuel (revenus − dépenses), avec ligne de zéro. */
export function NetResultChart({ data, height = 260 }: NetResultChartProps) {
  const points = data.map((point) => ({
    month: point.month,
    resultat: point.revenus - point.depenses,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
          <ReferenceLine y={0} stroke={CHART_CHROME.baseline} strokeWidth={1} />
          <Tooltip content={<ChartTooltip labelFormatter={formatMonth} />} />
          <Line
            dataKey="resultat"
            name="Résultat net"
            stroke={CHART_COLORS.aqua}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
