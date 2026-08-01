import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getVariant, isValidSectionOrder } from "./catalog";
import {
  isSegmentKey,
  isSlotKey,
  type LandingCapabilities,
  type LandingConfig,
  type SectionKey,
  type SegmentRule,
  type SlotKey,
  type Testimonial,
} from "./types";

/**
 * Landing Intelligence — CONFIGURATION ACTIVE du moteur.
 *
 * La landing est rendue à chaque requête (personnalisation serveur), il est
 * donc hors de question d'interroger la base à chaque visite : la
 * configuration ET les contenus dont dépendent les variantes sont chargés
 * une fois puis gardés en mémoire du processus pendant `CACHE_TTL_MS`.
 * Une écriture depuis l'administration invalide le cache immédiatement.
 *
 * Le moteur ne tombe JAMAIS en panne : sans base, sans migration ou en cas
 * d'erreur, on sert la configuration par défaut (contenu d'origine).
 */

/** Règles de personnalisation livrées par défaut (modifiables dans l'admin). */
export const DEFAULT_RULES: SegmentRule[] = [
  // Réseaux sociaux : arrivée mobile, attention courte → vidéo + promesse directe.
  { segment: "tiktok", slot: "hero_headline", variant: "mobile", origin: "default" },
  { segment: "tiktok", slot: "hero_media", variant: "video", origin: "default" },
  { segment: "tiktok", slot: "hero_cta", variant: "instant", origin: "default" },
  { segment: "tiktok", slot: "section_order", variant: "demo_first", origin: "default" },
  { segment: "facebook", slot: "hero_headline", variant: "problem", origin: "default" },
  { segment: "facebook", slot: "hero_media", variant: "video", origin: "default" },
  // Recherche Google : intention explicite → montrer l'outil et lever l'objection prix.
  { segment: "google", slot: "hero_headline", variant: "problem", origin: "default" },
  { segment: "google", slot: "hero_media", variant: "preview", origin: "default" },
  { segment: "google", slot: "hero_cta", variant: "no_card", origin: "default" },
  // LinkedIn : audience professionnelle → discours produit + plan Pro.
  { segment: "linkedin", slot: "hero_headline", variant: "control", origin: "default" },
  { segment: "linkedin", slot: "pricing_emphasis", variant: "pro", origin: "default" },
  // Partenaire / QR : le visiteur vient d'une recommandation → aller au produit.
  { segment: "partner", slot: "hero_cta", variant: "no_card", origin: "default" },
  { segment: "partner", slot: "section_order", variant: "pricing_early", origin: "default" },
  { segment: "qr", slot: "hero_media", variant: "preview", origin: "default" },
  { segment: "qr", slot: "section_order", variant: "demo_first", origin: "default" },
  // Visiteur déjà venu / connecté : ne pas répéter la découverte.
  { segment: "returning", slot: "hero_cta", variant: "resume", origin: "default" },
  { segment: "returning", slot: "section_order", variant: "pricing_early", origin: "default" },
  { segment: "member", slot: "hero_cta", variant: "member", origin: "default" },
];

export const DEFAULT_CONFIG: LandingConfig = {
  version: 1,
  autopilot: true,
  // Aucune variante ne descend sous 8 % du trafic : le moteur continue
  // d'apprendre en permanence, même sur les variantes perdantes.
  explorationFloor: 0.08,
  // 15 % des sessions ignorent les règles de personnalisation : c'est le
  // témoin qui permet de mesurer si la personnalisation apporte vraiment.
  ruleHoldout: 0.15,
  weights: {},
  pins: {},
  rules: DEFAULT_RULES,
  disabled: [],
  customOrders: {},
  updatedAt: new Date(0).toISOString(),
};

export const EMPTY_CAPABILITIES: LandingCapabilities = { videoUrl: null, testimonials: [] };

/* ------------------------------------------------------------------ */
/*  Normalisation (défensive : la base peut contenir n'importe quoi)   */
/* ------------------------------------------------------------------ */

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Une variante existe si elle est au catalogue — ou, pour l'ordre des
 * sections, s'il s'agit d'un ordre composé par le moteur et validé.
 */
function variantExists(slot: SlotKey, variant: string, customOrders: Record<string, SectionKey[]>): boolean {
  if (getVariant(slot, variant)) return true;
  return slot === "section_order" && Object.hasOwn(customOrders, variant);
}

function coerceWeights(
  raw: unknown,
  customOrders: Record<string, SectionKey[]>
): Partial<Record<SlotKey, Record<string, number>>> {
  const out: Partial<Record<SlotKey, Record<string, number>>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSlotKey(slot) || !value || typeof value !== "object") continue;
    const entries: Record<string, number> = {};
    for (const [variant, weight] of Object.entries(value as Record<string, unknown>)) {
      // Une variante supprimée du catalogue disparaît automatiquement.
      if (!variantExists(slot, variant, customOrders)) continue;
      const w = Number(weight);
      if (Number.isFinite(w) && w >= 0) entries[variant] = w;
    }
    if (Object.keys(entries).length > 0) out[slot] = entries;
  }
  return out;
}

function coercePins(
  raw: unknown,
  customOrders: Record<string, SectionKey[]>
): Partial<Record<SlotKey, string>> {
  const out: Partial<Record<SlotKey, string>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [slot, variant] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSlotKey(slot) || typeof variant !== "string") continue;
    if (variantExists(slot, variant, customOrders)) out[slot] = variant;
  }
  return out;
}

function coerceRules(raw: unknown, customOrders: Record<string, SectionKey[]>): SegmentRule[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SegmentRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const segment = o.segment === "any" || isSegmentKey(o.segment) ? o.segment : null;
    if (!segment || !isSlotKey(o.slot) || typeof o.variant !== "string") continue;
    if (!variantExists(o.slot, o.variant, customOrders)) continue;
    const device =
      o.device === "mobile" || o.device === "tablet" || o.device === "desktop" ? o.device : null;
    // Une seule règle par couple (segment + appareil, slot) : la première gagne.
    const id = `${segment}:${device ?? "*"}:${o.slot}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const origin = o.origin;
    out.push({
      segment,
      device,
      slot: o.slot,
      variant: o.variant,
      origin:
        origin === "manual" || origin === "recommendation" || origin === "default" ? origin : "manual",
    });
  }
  return out.slice(0, 120);
}

function coerceCustomOrders(raw: unknown): Record<string, SectionKey[]> {
  const out: Record<string, SectionKey[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(key)) continue;
    if (isValidSectionOrder(value)) out[key] = value;
  }
  return out;
}

/** Garantit une configuration complète et cohérente, quelle que soit l'entrée. */
export function coerceConfig(raw: unknown): LandingConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hasRules = Array.isArray(o.rules);
  const customOrders = coerceCustomOrders(o.customOrders);
  return {
    version: Math.max(1, Math.trunc(num(o.version, 1, 1, 1_000_000))),
    autopilot: typeof o.autopilot === "boolean" ? o.autopilot : DEFAULT_CONFIG.autopilot,
    explorationFloor: num(o.explorationFloor, DEFAULT_CONFIG.explorationFloor, 0.02, 0.5),
    ruleHoldout: num(o.ruleHoldout, DEFAULT_CONFIG.ruleHoldout, 0, 0.5),
    weights: coerceWeights(o.weights, customOrders),
    pins: coercePins(o.pins, customOrders),
    // Une configuration sans clé `rules` est une configuration jamais éditée :
    // on sert les règles par défaut. Un tableau vide explicite est respecté.
    rules: hasRules ? coerceRules(o.rules, customOrders) : DEFAULT_RULES,
    disabled: Array.isArray(o.disabled)
      ? o.disabled.filter((d): d is string => typeof d === "string" && /^[a-z_]+:[a-z0-9_-]+$/.test(d)).slice(0, 100)
      : [],
    customOrders,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : DEFAULT_CONFIG.updatedAt,
  };
}

function coerceTestimonials(raw: unknown): Testimonial[] {
  if (!Array.isArray(raw)) return [];
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return raw
    .map((item) => {
      const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return { quote: s(o.quote, 400), author: s(o.author, 80), role: s(o.role, 120) };
    })
    .filter((t) => t.quote.length > 0 && t.author.length > 0)
    .slice(0, 12);
}

/* ------------------------------------------------------------------ */
/*  Chargement (cache mémoire)                                        */
/* ------------------------------------------------------------------ */

export interface EngineState {
  config: LandingConfig;
  capabilities: LandingCapabilities;
  /** false quand la base est injoignable : la landing sert alors les défauts. */
  live: boolean;
}

const CACHE_TTL_MS = 60_000;

let cache: { state: EngineState; at: number } | null = null;

/** Invalide le cache (appelé après chaque écriture depuis l'administration). */
export function invalidateEngineCache(): void {
  cache = null;
}

const FALLBACK_STATE: EngineState = {
  config: DEFAULT_CONFIG,
  capabilities: EMPTY_CAPABILITIES,
  live: false,
};

/** Clé `site_settings` des témoignages réels affichés sur la vitrine. */
export const TESTIMONIALS_KEY = "landing_testimonials";

async function loadEngineState(): Promise<EngineState> {
  if (!isAdminConfigured) return FALLBACK_STATE;
  const admin = createAdminClient();
  const [configRes, settingsRes] = await Promise.all([
    admin.from("landing_config").select("version, config").eq("id", true).maybeSingle(),
    admin.from("site_settings").select("key, value").in("key", ["company_profile", TESTIMONIALS_KEY]),
  ]);

  if (configRes.error) throw new Error(configRes.error.message);

  const stored = (configRes.data?.config ?? {}) as Record<string, unknown>;
  const config = coerceConfig({ ...stored, version: configRes.data?.version ?? 1 });

  let videoUrl: string | null = null;
  let testimonials: Testimonial[] = [];
  for (const row of settingsRes.data ?? []) {
    if (row.key === "company_profile") {
      const profile = (row.value ?? {}) as Record<string, unknown>;
      const video = profile.video as Record<string, unknown> | null | undefined;
      const url = typeof video?.url === "string" ? video.url : "";
      const legacy = typeof profile.videoUrl === "string" ? profile.videoUrl : "";
      videoUrl = url || legacy || null;
    } else if (row.key === TESTIMONIALS_KEY) {
      testimonials = coerceTestimonials(row.value);
    }
  }

  return { config, capabilities: { videoUrl, testimonials }, live: true };
}

/**
 * État du moteur (configuration + contenus disponibles), mis en cache.
 * Jamais bloquant : toute erreur retombe sur la configuration par défaut.
 */
export async function getEngineState(): Promise<EngineState> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.state;
  try {
    const state = await loadEngineState();
    cache = { state, at: now };
    return state;
  } catch (e) {
    logger.error("landing/config", e);
    // On garde le dernier état connu plutôt que de dégrader la page.
    if (cache) return cache.state;
    cache = { state: FALLBACK_STATE, at: now };
    return FALLBACK_STATE;
  }
}

/** Configuration active, sans cache — pour l'administration. */
export async function getLandingConfigFresh(): Promise<LandingConfig> {
  if (!isAdminConfigured) return DEFAULT_CONFIG;
  const { data, error } = await createAdminClient()
    .from("landing_config")
    .select("version, config")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la configuration impossible : ${error.message}`);
  return coerceConfig({ ...((data?.config ?? {}) as object), version: data?.version ?? 1 });
}

/** Contenus disponibles (vidéo, témoignages), sans cache — pour l'administration. */
export async function getCapabilitiesFresh(): Promise<LandingCapabilities> {
  if (!isAdminConfigured) return EMPTY_CAPABILITIES;
  const { data } = await createAdminClient()
    .from("site_settings")
    .select("key, value")
    .in("key", ["company_profile", TESTIMONIALS_KEY]);
  let videoUrl: string | null = null;
  let testimonials: Testimonial[] = [];
  for (const row of data ?? []) {
    if (row.key === "company_profile") {
      const profile = (row.value ?? {}) as Record<string, unknown>;
      const video = profile.video as Record<string, unknown> | null | undefined;
      const url = typeof video?.url === "string" ? video.url : "";
      const legacy = typeof profile.videoUrl === "string" ? profile.videoUrl : "";
      videoUrl = url || legacy || null;
    } else if (row.key === TESTIMONIALS_KEY) {
      testimonials = coerceTestimonials(row.value);
    }
  }
  return { videoUrl, testimonials };
}

export { coerceTestimonials };
