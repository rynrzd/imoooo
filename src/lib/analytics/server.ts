import { createHash } from "node:crypto";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Analytics first-party — SERVEUR uniquement (clé secrète).
 *
 * RGPD : aucune donnée personnelle stockée. Le visiteur est identifié par un
 * HASH non réversible (SHA-256 salé quotidien de IP + user-agent) — jamais
 * l'IP en clair, jamais de cookie de suivi. Pays / ville viennent des en-têtes
 * géo de l'hébergeur (granularité légale). Jamais de mot de passe, de carte
 * ni de contenu de document.
 */

export type AnalyticsEventType =
  | "page_view"
  | "signup"
  | "property_added"
  | "payment_started"
  | "subscription_success"
  | "payment_failed";

export type TrafficSource = "tiktok" | "linkedin" | "facebook" | "google" | "direct" | "other";
export type DeviceType = "mobile" | "desktop" | "tablet";

/** Chemin d'URL nettoyé : sans query string, borné, jamais de donnée perso. */
export function sanitizePath(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/")) return "/";
  const path = value.split(/[?#]/)[0] || "/";
  return path.slice(0, 300);
}

/** true pour les chemins techniques / fichiers (jamais comptés comme pages). */
export function isBotPath(path: string): boolean {
  return (
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    /\.(png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|woff2?|ttf)$/i.test(path)
  );
}

/** Famille d'appareil déduite du user-agent (jamais la chaîne complète). */
export function detectDevice(userAgent: string | null | undefined): DeviceType {
  const ua = userAgent ?? "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Source de trafic normalisée : utm_source prioritaire, sinon referrer. */
export function detectSource(
  referrer: string | null | undefined,
  utmSource: string | null | undefined
): TrafficSource {
  const utm = (utmSource ?? "").trim().toLowerCase();
  const classify = (needle: string): TrafficSource | null => {
    if (/tiktok/.test(needle)) return "tiktok";
    if (/linkedin|lnkd\.in/.test(needle)) return "linkedin";
    if (/facebook|fb\.com|fb\.me|meta\.com/.test(needle)) return "facebook";
    if (/google|goog\.gl/.test(needle)) return "google";
    return null;
  };
  if (utm) return classify(utm) ?? "other";

  const ref = (referrer ?? "").trim();
  if (!ref) return "direct";
  let host = "";
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    host = ref.toLowerCase();
  }
  // Referrer interne (même site) = accès direct.
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").toLowerCase();
  if (site && host.endsWith(site)) return "direct";
  return classify(host) ?? "other";
}

/** Hash visiteur cookieless, non réversible, tournant chaque jour. */
export function visitorHash(ip: string | null | undefined, userAgent: string | null | undefined): string {
  const salt = process.env.REF_IP_SALT?.trim() || "nireo-analytics-v1";
  const day = new Date().toISOString().slice(0, 10); // rotation quotidienne
  return createHash("sha256")
    .update(`${salt}:${day}:${(ip ?? "").trim()}:${(userAgent ?? "").trim()}`)
    .digest("hex");
}

/** Première IP publique depuis les en-têtes proxy (jamais stockée en clair). */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    ""
  );
}

/** Pays / ville depuis les en-têtes géo de l'hébergeur (Vercel). */
export function geoFromHeaders(headers: Headers): { country: string | null; city: string | null } {
  const country = (headers.get("x-vercel-ip-country") || "").trim().toUpperCase() || null;
  let city: string | null = null;
  const rawCity = headers.get("x-vercel-ip-city");
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).trim() || null;
    } catch {
      city = rawCity.trim() || null;
    }
  }
  return { country, city: city ? city.slice(0, 120) : null };
}

interface PageViewInput {
  path: string;
  sessionId: string | null;
  source: TrafficSource;
  device: DeviceType;
  visitorHash: string;
  country: string | null;
  city: string | null;
}

/** Enregistre une page vue (best-effort — jamais bloquant pour le visiteur). */
export async function recordPageView(input: PageViewInput): Promise<void> {
  if (!isAdminConfigured) return;
  try {
    const { error } = await createAdminClient().from("analytics_events").insert({
      event_type: "page_view",
      path: input.path,
      visitor_hash: input.visitorHash,
      session_id: input.sessionId ? input.sessionId.slice(0, 64) : null,
      source: input.source,
      device: input.device,
      country: input.country,
      city: input.city,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    logger.error("analytics/page_view", e);
  }
}

interface BusinessEventInput {
  userId?: string | null;
  plan?: string | null;
  amountCents?: number | null;
}

/**
 * Enregistre un événement métier (signup géré par trigger SQL ; ici :
 * payment_started, subscription_success, payment_failed). Best-effort.
 */
export async function recordAnalyticsEvent(
  eventType: Exclude<AnalyticsEventType, "page_view" | "signup" | "property_added">,
  input: BusinessEventInput = {}
): Promise<void> {
  if (!isAdminConfigured) return;
  try {
    const { error } = await createAdminClient().from("analytics_events").insert({
      event_type: eventType,
      user_id: input.userId ?? null,
      plan: input.plan ?? null,
      amount_cents: typeof input.amountCents === "number" ? Math.max(0, Math.round(input.amountCents)) : null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    logger.error(`analytics/${eventType}`, e);
  }
}
