import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsEventType } from "./server";

/**
 * Lecture des statistiques réelles pour l'espace admin. Toutes les
 * agrégations sont faites en base (fonctions SQL SECURITY DEFINER appelées
 * via la clé secrète). Aucune donnée fictive, aucune valeur aléatoire.
 */

export const ANALYTICS_RANGES = ["24h", "7d", "30d", "12m"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return typeof value === "string" && (ANALYTICS_RANGES as readonly string[]).includes(value);
}

export interface AnalyticsKpis {
  onlineNow: number;
  uniqueToday: number;
  uniqueWeek: number;
  uniqueMonth: number;
  totalViews: number;
  viewsToday: number;
  signupsToday: number;
  signupsWeek: number;
  signupsMonth: number;
  subsToday: number;
  subsWeek: number;
  subsMonth: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
}

export interface Slice {
  key: string;
  count: number;
}

export interface Breakdowns {
  sources: Slice[];
  devices: Slice[];
  topPages: Slice[];
  countries: Slice[];
  cities: Slice[];
}

export interface SeriesPoint {
  bucket: string;
  views: number;
  visitors: number;
}

export interface LiveEvent {
  type: AnalyticsEventType;
  path: string | null;
  plan: string | null;
  amountCents: number | null;
  source: string | null;
  device: string | null;
  country: string | null;
  at: string;
}

export interface AnalyticsSnapshot {
  range: AnalyticsRange;
  generatedAt: string;
  kpis: AnalyticsKpis;
  breakdowns: Breakdowns;
  activePages: Slice[];
  series: SeriesPoint[];
  live: LiveEvent[];
}

/** Fenêtre (bucket + date de début) associée à une plage. */
function rangeWindow(range: AnalyticsRange): { bucket: "hour" | "day" | "month"; since: Date } {
  const since = new Date();
  switch (range) {
    case "24h":
      since.setUTCHours(since.getUTCHours() - 23);
      return { bucket: "hour", since };
    case "7d":
      since.setUTCDate(since.getUTCDate() - 6);
      return { bucket: "day", since };
    case "30d":
      since.setUTCDate(since.getUTCDate() - 29);
      return { bucket: "day", since };
    case "12m":
      since.setUTCMonth(since.getUTCMonth() - 11);
      return { bucket: "month", since };
  }
}

/** Snapshot complet et réel des statistiques pour une plage donnée. */
export async function getAnalyticsSnapshot(range: AnalyticsRange): Promise<AnalyticsSnapshot> {
  const admin = createAdminClient();
  const { bucket, since } = rangeWindow(range);
  const sinceIso = since.toISOString();

  const [kpis, breakdowns, activePages, series, live] = await Promise.all([
    admin.rpc("analytics_kpis"),
    admin.rpc("analytics_breakdowns", { p_since: sinceIso }),
    admin.rpc("analytics_active_pages"),
    admin.rpc("analytics_series", { p_bucket: bucket, p_since: sinceIso }),
    admin.rpc("analytics_live", { p_limit: 30 }),
  ]);

  const firstError =
    kpis.error || breakdowns.error || activePages.error || series.error || live.error;
  if (firstError) {
    throw new Error(`Lecture des statistiques impossible : ${firstError.message}`);
  }

  return {
    range,
    generatedAt: new Date().toISOString(),
    kpis: kpis.data as AnalyticsKpis,
    breakdowns: breakdowns.data as Breakdowns,
    activePages: (activePages.data ?? []) as Slice[],
    series: (series.data ?? []) as SeriesPoint[],
    live: (live.data ?? []) as LiveEvent[],
  };
}
