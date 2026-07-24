import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Statistiques du dashboard Marketing — calculées depuis les VRAIES
 * tables (clics, attributions, commissions). Aucune donnée simulée.
 */

export type MarketingPeriod = "7j" | "30j" | "90j" | "12m" | "tout";

export const PERIOD_LABELS: Record<MarketingPeriod, string> = {
  "7j": "7 derniers jours",
  "30j": "30 derniers jours",
  "90j": "90 derniers jours",
  "12m": "12 derniers mois",
  tout: "Depuis le début",
};

export function sanitizePeriod(raw: string | undefined): MarketingPeriod {
  return raw === "7j" || raw === "90j" || raw === "12m" || raw === "tout" ? raw : "30j";
}

export function periodStart(period: MarketingPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "7j":
      return new Date(now.getTime() - 7 * 86400_000);
    case "30j":
      return new Date(now.getTime() - 30 * 86400_000);
    case "90j":
      return new Date(now.getTime() - 90 * 86400_000);
    case "12m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 12);
      return d;
    }
    case "tout":
      return null;
  }
}

export interface MarketingOverview {
  totalPartners: number;
  activePartners: number;
  clicks: number;
  signups: number;
  conversions: number;
  /** Inscriptions → clients payants, en % (0 si aucune inscription). */
  conversionRate: number;
  /** CA TTC encaissé attribué (commissions vivantes), centimes. */
  grossRevenueCents: number;
  pendingCents: number;
  approvedCents: number;
  payableCents: number;
  paidCents: number;
}

/** Vue d'ensemble sur une période (null = depuis le début). */
export async function getMarketingOverview(since: Date | null): Promise<MarketingOverview> {
  const admin = createAdminClient();
  const sinceIso = since?.toISOString();

  let clicksQuery = admin.from("partner_clicks").select("id", { count: "exact", head: true });
  let signupsQuery = admin.from("partner_attributions").select("id", { count: "exact", head: true });
  let conversionsQuery = admin
    .from("partner_attributions")
    .select("id", { count: "exact", head: true })
    .eq("status", "converted");
  let commissionsQuery = admin
    .from("partner_commissions")
    .select("status, gross_amount, commission_amount")
    .limit(100000);
  if (sinceIso) {
    clicksQuery = clicksQuery.gte("clicked_at", sinceIso);
    signupsQuery = signupsQuery.gte("signup_at", sinceIso);
    conversionsQuery = conversionsQuery.gte("signup_at", sinceIso);
    commissionsQuery = commissionsQuery.gte("earned_at", sinceIso);
  }

  const [partners, activePartners, clicks, signups, conversions, commissions] = await Promise.all([
    admin.from("marketing_partners").select("id", { count: "exact", head: true }),
    admin
      .from("marketing_partners")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    clicksQuery,
    signupsQuery,
    conversionsQuery,
    commissionsQuery,
  ]);

  for (const r of [partners, activePartners, clicks, signups, conversions]) {
    if (r.error) throw new Error(`Lecture des statistiques impossible : ${r.error.message}`);
  }
  if (commissions.error) {
    throw new Error(`Lecture des commissions impossible : ${commissions.error.message}`);
  }

  let grossRevenueCents = 0;
  let pendingCents = 0;
  let approvedCents = 0;
  let payableCents = 0;
  let paidCents = 0;
  for (const row of commissions.data ?? []) {
    const status = row.status as string;
    const amount = (row.commission_amount as number) ?? 0;
    if (status !== "cancelled" && status !== "reversed") {
      grossRevenueCents += (row.gross_amount as number) ?? 0;
    }
    if (status === "pending") pendingCents += amount;
    else if (status === "approved") approvedCents += amount;
    else if (status === "payable") payableCents += amount;
    else if (status === "paid") paidCents += amount;
  }

  const signupCount = signups.count ?? 0;
  const conversionCount = conversions.count ?? 0;

  return {
    totalPartners: partners.count ?? 0,
    activePartners: activePartners.count ?? 0,
    clicks: clicks.count ?? 0,
    signups: signupCount,
    conversions: conversionCount,
    conversionRate: signupCount > 0 ? Math.round((conversionCount / signupCount) * 1000) / 10 : 0,
    grossRevenueCents,
    pendingCents,
    approvedCents,
    payableCents,
    paidCents,
  };
}

export interface TrendPoint {
  /** Clé de regroupement : « 2026-07-24 » (jour) ou « 2026-07 » (mois). */
  key: string;
  /** Libellé court pour l'axe (« 24 juil. » ou « juil. 26 »). */
  label: string;
  clicks: number;
  signups: number;
  conversions: number;
}

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

/**
 * Évolution clics / inscriptions / conversions.
 * `granularity` jour (7 ou 30 points) ou mois (12 points) — toutes les
 * dates de la fenêtre sont présentes, même à zéro.
 */
export async function getMarketingTrend(
  days: 7 | 30 | 365,
  partnerId?: string
): Promise<TrendPoint[]> {
  const admin = createAdminClient();
  const monthly = days === 365;
  const since = new Date();
  if (monthly) {
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
  } else {
    since.setDate(since.getDate() - (days - 1));
  }
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  let clicksQuery = admin
    .from("partner_clicks")
    .select("clicked_at")
    .gte("clicked_at", sinceIso)
    .limit(100000);
  let attributionsQuery = admin
    .from("partner_attributions")
    .select("signup_at, converted_at")
    .gte("signup_at", sinceIso)
    .limit(100000);
  if (partnerId) {
    clicksQuery = clicksQuery.eq("partner_id", partnerId);
    attributionsQuery = attributionsQuery.eq("partner_id", partnerId);
  }

  const [clicks, attributions] = await Promise.all([clicksQuery, attributionsQuery]);
  if (clicks.error) throw new Error(`Lecture des clics impossible : ${clicks.error.message}`);
  if (attributions.error) {
    throw new Error(`Lecture des inscriptions impossible : ${attributions.error.message}`);
  }

  const keyOf = (iso: string): string => (monthly ? iso.slice(0, 7) : iso.slice(0, 10));

  // Fenêtre complète, y compris les jours/mois à zéro.
  const points = new Map<string, TrendPoint>();
  const cursor = new Date(since);
  const now = new Date();
  while (cursor <= now) {
    const iso = cursor.toISOString();
    const key = keyOf(iso);
    if (!points.has(key)) {
      points.set(key, {
        key,
        label: monthly ? MONTH_LABEL.format(cursor) : DAY_LABEL.format(cursor),
        clicks: 0,
        signups: 0,
        conversions: 0,
      });
    }
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of clicks.data ?? []) {
    const point = points.get(keyOf(row.clicked_at as string));
    if (point) point.clicks += 1;
  }
  for (const row of attributions.data ?? []) {
    const signup = points.get(keyOf(row.signup_at as string));
    if (signup) signup.signups += 1;
    const converted = row.converted_at as string | null;
    if (converted) {
      const conversion = points.get(keyOf(converted));
      if (conversion) conversion.conversions += 1;
    }
  }

  return [...points.values()];
}

export interface TopPartner {
  id: string;
  name: string;
  companyName: string;
  clicks: number;
  signups: number;
  conversions: number;
  commissionCents: number;
  grossCents: number;
}

/** Meilleurs partenaires (classés par CA généré puis conversions). */
export async function getTopPartners(since: Date | null, limit = 5): Promise<TopPartner[]> {
  const admin = createAdminClient();
  const sinceIso = since?.toISOString();

  const { data: partners, error } = await admin
    .from("marketing_partners")
    .select("id, name, company_name")
    .limit(1000);
  if (error) throw new Error(`Lecture des partenaires impossible : ${error.message}`);
  if (!partners || partners.length === 0) return [];

  const byId = new Map<string, TopPartner>();
  for (const p of partners) {
    byId.set(p.id as string, {
      id: p.id as string,
      name: p.name as string,
      companyName: (p.company_name as string) ?? "",
      clicks: 0,
      signups: 0,
      conversions: 0,
      commissionCents: 0,
      grossCents: 0,
    });
  }

  let clicksQuery = admin.from("partner_clicks").select("partner_id").limit(100000);
  let attributionsQuery = admin
    .from("partner_attributions")
    .select("partner_id, status")
    .limit(100000);
  let commissionsQuery = admin
    .from("partner_commissions")
    .select("partner_id, status, gross_amount, commission_amount")
    .limit(100000);
  if (sinceIso) {
    clicksQuery = clicksQuery.gte("clicked_at", sinceIso);
    attributionsQuery = attributionsQuery.gte("signup_at", sinceIso);
    commissionsQuery = commissionsQuery.gte("earned_at", sinceIso);
  }

  const [clicks, attributions, commissions] = await Promise.all([
    clicksQuery,
    attributionsQuery,
    commissionsQuery,
  ]);
  if (clicks.error || attributions.error || commissions.error) {
    throw new Error("Lecture des statistiques partenaires impossible.");
  }

  for (const row of clicks.data ?? []) {
    const partner = byId.get(row.partner_id as string);
    if (partner) partner.clicks += 1;
  }
  for (const row of attributions.data ?? []) {
    const partner = byId.get(row.partner_id as string);
    if (!partner) continue;
    partner.signups += 1;
    if ((row.status as string) === "converted") partner.conversions += 1;
  }
  for (const row of commissions.data ?? []) {
    const partner = byId.get(row.partner_id as string);
    if (!partner) continue;
    const status = row.status as string;
    if (status === "cancelled" || status === "reversed") continue;
    partner.grossCents += (row.gross_amount as number) ?? 0;
    partner.commissionCents += (row.commission_amount as number) ?? 0;
  }

  return [...byId.values()]
    .filter((p) => p.clicks + p.signups + p.grossCents > 0)
    .sort((a, b) => b.grossCents - a.grossCents || b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, limit);
}
