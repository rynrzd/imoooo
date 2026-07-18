"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrencyCompact } from "@/lib/format";
import { AXIS_TICK, CHART_CHROME, CHART_COLORS } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

interface RevenueByPropertyChartProps {
  data: { name: string; revenus: number }[];
}

/** Barres horizontales : revenus encaissés par logement (12 derniers mois). */
export function RevenueByPropertyChart({ data }: RevenueByPropertyChartProps) {
  const height = Math.max(180, data.length * 44 + 24);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 0, left: 8 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ ...AXIS_TICK, fill: "#52514e" }}
            tickLine={false}
            axisLine={{ stroke: CHART_CHROME.baseline, strokeWidth: 1 }}
            width={132}
          />
          <Tooltip
            cursor={{ fill: "rgba(11, 11, 11, 0.04)" }}
            content={<ChartTooltip />}
          />
          <Bar
            dataKey="revenus"
            name="Revenus"
            fill={CHART_COLORS.revenue}
            barSize={16}
            radius={[0, 4, 4, 0]}
          >
            <LabelList
              dataKey="revenus"
              position="right"
              formatter={(value) =>
                typeof value === "number" ? formatCurrencyCompact(value) : value
              }
              className="fill-foreground"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
