"use client";

import { formatCurrency } from "@/lib/format";

interface TooltipEntry {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  /** Formate le libellé d'en-tête (ex. mois court → mois complet). */
  labelFormatter?: (label: string) => string;
}

/** Infobulle commune à tous les graphiques : carte claire, valeurs monétaires. */
export function ChartTooltip({ active, label, payload, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading =
    label !== undefined && labelFormatter ? labelFormatter(String(label)) : label;

  return (
    <div className="min-w-36 rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      {heading !== undefined ? (
        <p className="mb-1.5 text-xs font-medium text-foreground">{heading}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {typeof entry.value === "number" ? formatCurrency(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Légende minimaliste affichée sous le titre d'un graphique. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
