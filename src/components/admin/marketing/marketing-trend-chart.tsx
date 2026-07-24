"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, CHART_CHROME, CHART_COLORS, LINE_WIDTH } from "@/components/charts/chart-theme";
import type { TrendPoint } from "@/lib/marketing/stats";

/**
 * Évolution clics / inscriptions / conversions. Données réelles fournies
 * par le serveur (aucune génération côté client). Style aligné sur les
 * graphiques existants (thème partagé, sobre).
 */
export function MarketingTrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  const empty = data.every((p) => p.clicks === 0 && p.signups === 0 && p.conversions === 0);

  return (
    <div style={{ height }} className="w-full">
      {empty ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Aucune activité sur cette période.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_CHROME.baseline, strokeWidth: 1 }} minTickGap={16} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: CHART_CHROME.baseline }}
              contentStyle={{
                borderRadius: 10,
                border: `1px solid ${CHART_CHROME.grid}`,
                fontSize: 12,
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            <Line type="monotone" dataKey="clicks" name="Clics" stroke={CHART_COLORS.revenue} strokeWidth={LINE_WIDTH} dot={false} />
            <Line type="monotone" dataKey="signups" name="Inscriptions" stroke={CHART_COLORS.aqua} strokeWidth={LINE_WIDTH} dot={false} />
            <Line type="monotone" dataKey="conversions" name="Clients payants" stroke={CHART_COLORS.violet} strokeWidth={LINE_WIDTH} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Legend color={CHART_COLORS.revenue} label="Clics" />
        <Legend color={CHART_COLORS.aqua} label="Inscriptions" />
        <Legend color={CHART_COLORS.violet} label="Clients payants" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
