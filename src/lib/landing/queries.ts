import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCapabilitiesFresh, getLandingConfigFresh, DEFAULT_CONFIG, EMPTY_CAPABILITIES } from "./config";
import { rangeWindow, type LandingRange } from "./ranges";
import {
  pickObjective,
  rankVariants,
  scoreSlot,
  type Objective,
  type VariantScore,
  type VariantStat,
} from "./scoring";
import type { LandingCapabilities, LandingConfig, SegmentKey } from "./types";

/**
 * Landing Intelligence — LECTURES POUR L'ADMINISTRATION.
 *
 * Toutes les agrégations sont faites en base (fonctions SQL SECURITY
 * DEFINER appelées avec la clé secrète). Aucune donnée fictive : si une
 * mesure n'existe pas encore, elle vaut zéro et l'interface l'affiche comme
 * telle.
 */

export { LANDING_RANGES, isLandingRange, rangeWindow } from "./ranges";
export type { LandingRange } from "./ranges";

export interface LandingKpis {
  sessions: number;
  visitors: number;
  engaged: number;
  ctaClicks: number;
  signupStarted: number;
  signups: number;
  planSelected: number;
  paymentStarted: number;
  payments: number;
  avgDwell: number;
  medianScroll: number;
  bounced: number;
  returning: number;
  liveSessions: number;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
}

export interface SegmentStat {
  segment: string;
  sessions: number;
  engaged: number;
  ctaClicks: number;
  signups: number;
  payments: number;
  avgDwell: number;
  avgScroll: number;
}

export interface SegmentVariantStat {
  segment: string;
  slot: string;
  variant: string;
  sessions: number;
  ctaClicks: number;
  signups: number;
  engaged: number;
}

export interface DeviceStat {
  device: string;
  sessions: number;
  engaged: number;
  ctaClicks: number;
  signups: number;
  avgDwell: number;
  avgScroll: number;
}

export interface SectionStat {
  section: string;
  sessions: number;
  avgDwell: number;
  exits: number;
  exitsWithoutCta: number;
}

export interface ScrollPoint {
  depth: number;
  sessions: number;
  ratio: number;
  mobile: number;
  desktop: number;
}

export interface HeatCell {
  x: number;
  y: number;
  count: number;
}

export interface ElementStat {
  element: string;
  clicks: number;
  sessions: number;
}

export interface LandingSeriesPoint {
  bucket: string;
  sessions: number;
  ctaClicks: number;
  signups: number;
  payments: number;
}

export interface LandingLiveEvent {
  type: string;
  segment: string | null;
  device: string | null;
  source: string | null;
  country: string | null;
  section: string | null;
  element: string | null;
  value: number | null;
  at: string;
}

export interface LandingRecommendation {
  id: string;
  key: string;
  kind: string;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  patch: Record<string, unknown>;
  impact: number;
  confidence: number;
  severity: "info" | "opportunity" | "warning";
  status: "open" | "applied" | "dismissed";
  appliedVersion: number | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface LandingVersionRow {
  id: string;
  version: number;
  label: string;
  reason: string;
  origin: string;
  createdAt: string;
  config: LandingConfig;
}

export interface LandingSnapshot {
  range: LandingRange;
  generatedAt: string;
  /** false quand la migration n'est pas encore appliquée. */
  ready: boolean;
  kpis: LandingKpis;
  funnel: FunnelStep[];
  variants: VariantStat[];
  scores: Record<string, VariantScore[]>;
  objective: Objective;
  segments: SegmentStat[];
  segmentVariants: SegmentVariantStat[];
  devices: DeviceStat[];
  sections: SectionStat[];
  scrollmap: ScrollPoint[];
  heatmap: HeatCell[];
  elements: ElementStat[];
  series: LandingSeriesPoint[];
  live: LandingLiveEvent[];
  recommendations: LandingRecommendation[];
  versions: LandingVersionRow[];
  config: LandingConfig;
  capabilities: LandingCapabilities;
}

const EMPTY_KPIS: LandingKpis = {
  sessions: 0,
  visitors: 0,
  engaged: 0,
  ctaClicks: 0,
  signupStarted: 0,
  signups: 0,
  planSelected: 0,
  paymentStarted: 0,
  payments: 0,
  avgDwell: 0,
  medianScroll: 0,
  bounced: 0,
  returning: 0,
  liveSessions: 0,
};

/** Notes par slot, calculées à partir des mesures réelles. */
export function scoresBySlot(
  variants: VariantStat[],
  objective: Objective
): Record<string, VariantScore[]> {
  const bySlot = new Map<string, VariantStat[]>();
  for (const stat of variants) {
    const list = bySlot.get(stat.slot) ?? [];
    list.push(stat);
    bySlot.set(stat.slot, list);
  }
  const out: Record<string, VariantScore[]> = {};
  for (const [slot, stats] of bySlot) {
    out[slot] = rankVariants(scoreSlot(stats, objective));
  }
  return out;
}

async function readRecommendations(): Promise<LandingRecommendation[]> {
  const { data, error } = await createAdminClient()
    .from("landing_recommendations")
    .select("*")
    .order("status", { ascending: true })
    .order("impact", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    key: row.key as string,
    kind: row.kind as string,
    title: row.title as string,
    detail: (row.detail as string) ?? "",
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    patch: (row.patch ?? {}) as Record<string, unknown>,
    impact: Number(row.impact ?? 0),
    confidence: Number(row.confidence ?? 0),
    severity: (row.severity as LandingRecommendation["severity"]) ?? "info",
    status: (row.status as LandingRecommendation["status"]) ?? "open",
    appliedVersion: (row.applied_version as number | null) ?? null,
    appliedAt: (row.applied_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

async function readVersions(): Promise<LandingVersionRow[]> {
  const { data, error } = await createAdminClient()
    .from("landing_versions")
    .select("id, version, label, reason, origin, created_at, config")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    version: Number(row.version ?? 1),
    label: (row.label as string) ?? "",
    reason: (row.reason as string) ?? "",
    origin: (row.origin as string) ?? "manual",
    createdAt: row.created_at as string,
    config: row.config as LandingConfig,
  }));
}

/** Photographie complète et réelle du moteur pour une plage donnée. */
export async function getLandingSnapshot(range: LandingRange): Promise<LandingSnapshot> {
  const generatedAt = new Date().toISOString();
  if (!isAdminConfigured) {
    return {
      range,
      generatedAt,
      ready: false,
      kpis: EMPTY_KPIS,
      funnel: [],
      variants: [],
      scores: {},
      objective: "engaged",
      segments: [],
      segmentVariants: [],
      devices: [],
      sections: [],
      scrollmap: [],
      heatmap: [],
      elements: [],
      series: [],
      live: [],
      recommendations: [],
      versions: [],
      config: DEFAULT_CONFIG,
      capabilities: EMPTY_CAPABILITIES,
    };
  }

  const admin = createAdminClient();
  const { bucket, since } = rangeWindow(range);
  const p_since = since.toISOString();

  const [
    kpis,
    funnel,
    variants,
    segments,
    segmentVariants,
    devices,
    sections,
    scrollmap,
    heatmap,
    elements,
    series,
    live,
    recommendations,
    versions,
    config,
    capabilities,
  ] = await Promise.all([
    admin.rpc("landing_kpis", { p_since }),
    admin.rpc("landing_funnel", { p_since }),
    admin.rpc("landing_variant_stats", { p_since }),
    admin.rpc("landing_segment_stats", { p_since }),
    admin.rpc("landing_segment_variant_stats", { p_since }),
    admin.rpc("landing_device_stats", { p_since }),
    admin.rpc("landing_sections", { p_since }),
    admin.rpc("landing_scrollmap", { p_since }),
    admin.rpc("landing_heatmap", { p_since, p_device: null }),
    admin.rpc("landing_elements", { p_since }),
    admin.rpc("landing_series", { p_bucket: bucket, p_since }),
    admin.rpc("landing_live", { p_limit: 40 }),
    readRecommendations(),
    readVersions(),
    getLandingConfigFresh(),
    getCapabilitiesFresh(),
  ]);

  const firstError =
    kpis.error ||
    funnel.error ||
    variants.error ||
    segments.error ||
    segmentVariants.error ||
    devices.error ||
    sections.error ||
    scrollmap.error ||
    heatmap.error ||
    elements.error ||
    series.error ||
    live.error;
  if (firstError) {
    throw new Error(`Lecture du moteur impossible : ${firstError.message}`);
  }

  const variantStats = (variants.data ?? []) as VariantStat[];
  const objective = pickObjective(variantStats);

  return {
    range,
    generatedAt,
    ready: true,
    kpis: (kpis.data ?? EMPTY_KPIS) as LandingKpis,
    funnel: (funnel.data ?? []) as FunnelStep[],
    variants: variantStats,
    scores: scoresBySlot(variantStats, objective),
    objective,
    segments: (segments.data ?? []) as SegmentStat[],
    segmentVariants: (segmentVariants.data ?? []) as SegmentVariantStat[],
    devices: (devices.data ?? []) as DeviceStat[],
    sections: (sections.data ?? []) as SectionStat[],
    scrollmap: (scrollmap.data ?? []) as ScrollPoint[],
    heatmap: (heatmap.data ?? []) as HeatCell[],
    elements: (elements.data ?? []) as ElementStat[],
    series: (series.data ?? []) as LandingSeriesPoint[],
    live: (live.data ?? []) as LandingLiveEvent[],
    recommendations,
    versions,
    config,
    capabilities,
  };
}

/** Statistiques brutes par variante sur une fenêtre — pour le moteur. */
export async function getVariantStats(sinceIso: string): Promise<VariantStat[]> {
  const { data, error } = await createAdminClient().rpc("landing_variant_stats", { p_since: sinceIso });
  if (error) throw new Error(error.message);
  return (data ?? []) as VariantStat[];
}

/** Croisement segment × variante — pour les recommandations de personnalisation. */
export async function getSegmentVariantStats(sinceIso: string): Promise<SegmentVariantStat[]> {
  const { data, error } = await createAdminClient().rpc("landing_segment_variant_stats", {
    p_since: sinceIso,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SegmentVariantStat[];
}

export type { SegmentKey };
