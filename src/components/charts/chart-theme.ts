/**
 * Thème des graphiques — palette catégorielle validée
 * (contraste + daltonisme) sur surface claire.
 */

export const CHART_COLORS = {
  /** Revenus / série principale. */
  revenue: "#2a78d6",
  /** Dépenses / série secondaire. */
  expense: "#eb6834",
  /** Série 3 (résultat, occupation…). */
  aqua: "#1baf7a",
  /** Série 4. */
  violet: "#4a3aa7",
} as const;

/** Habillage recessif : grilles, axes, textes. */
export const CHART_CHROME = {
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  tick: "#898781",
} as const;

export const AXIS_TICK = {
  fill: CHART_CHROME.tick,
  fontSize: 12,
} as const;

/** Specs de marques partagées (voir guide interne de dataviz). */
export const BAR_SIZE = 20;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const LINE_WIDTH = 2;

/**
 * Définitions de séries — ici (module sans recharts) pour que les pages
 * qui n'affichent que la légende n'embarquent pas la librairie de charts.
 */
export interface MonthlySeries {
  dataKey: "revenus" | "depenses";
  name: string;
  color: string;
}

export const REVENUE_SERIES: MonthlySeries = {
  dataKey: "revenus",
  name: "Revenus",
  color: CHART_COLORS.revenue,
};

export const EXPENSE_SERIES: MonthlySeries = {
  dataKey: "depenses",
  name: "Dépenses",
  color: CHART_COLORS.expense,
};
