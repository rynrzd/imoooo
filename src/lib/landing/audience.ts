import type { DeviceKey, SegmentKey, VisitorProfile } from "./types";

/**
 * Landing Intelligence — DÉTECTION D'AUDIENCE.
 *
 * Fonctions pures, sans dépendance serveur : elles sont utilisées aussi bien
 * par le proxy (qui pose l'identité) que par le rendu serveur de la landing.
 *
 * RGPD : l'identifiant visiteur est un UUID ALÉATOIRE posé par le serveur
 * dans un cookie first-party HttpOnly. Il n'est dérivé ni de l'IP, ni de
 * l'appareil, ni d'un compte : il ne sert qu'à garder la même version de page
 * d'une visite à l'autre et à relier une conversion à ce qui a été affiché.
 */

/** Identité du visiteur (UUID aléatoire). */
export const VISITOR_COOKIE = "nireo_vid";
/** Compteur de visites + source d'acquisition, format compact. */
export const VISIT_COOKIE = "nireo_vst";
/** Cookie d'attribution partenaire posé par le module Marketing. */
export const PARTNER_COOKIE = "nireo_ref";

/** Durée de vie de l'identité : 1 an. */
export const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 3600;
/** Au-delà de 30 minutes d'inactivité, on compte une nouvelle visite. */
export const VISIT_GAP_MS = 30 * 60 * 1000;

export interface VisitState {
  /** Nombre de visites distinctes (1 = première). */
  count: number;
  /** Première visite (secondes epoch). */
  first: number;
  /** Dernier événement connu (secondes epoch). */
  last: number;
  /** Source d'acquisition retenue pour la visite en cours. */
  source: string;
}

const KNOWN_SOURCES = new Set([
  "tiktok",
  "facebook",
  "linkedin",
  "google",
  "qr",
  "partner",
  "other",
  "direct",
]);

/* ------------------------------------------------------------------ */
/*  Cookies                                                           */
/* ------------------------------------------------------------------ */

/** `v1.count.first.last.source` — court, lisible, sans donnée personnelle. */
export function serializeVisit(state: VisitState): string {
  const source = KNOWN_SOURCES.has(state.source) ? state.source : "direct";
  return `v1.${Math.max(1, Math.trunc(state.count))}.${Math.trunc(state.first)}.${Math.trunc(state.last)}.${source}`;
}

export function parseVisit(raw: string | undefined | null): VisitState | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return null;
  const count = Number(parts[1]);
  const first = Number(parts[2]);
  const last = Number(parts[3]);
  const source = parts[4] ?? "direct";
  if (!Number.isFinite(count) || !Number.isFinite(first) || !Number.isFinite(last)) return null;
  return {
    count: Math.min(10_000, Math.max(1, Math.trunc(count))),
    first: Math.trunc(first),
    last: Math.trunc(last),
    source: KNOWN_SOURCES.has(source) ? source : "direct",
  };
}

/** true si la valeur ressemble à un identifiant posé par nous. */
export function isValidVisitorId(raw: string | undefined | null): boolean {
  return typeof raw === "string" && /^[0-9a-f-]{8,64}$/i.test(raw);
}

/* ------------------------------------------------------------------ */
/*  Classification                                                    */
/* ------------------------------------------------------------------ */

function classifyHost(needle: string): SegmentKey | null {
  if (/tiktok/.test(needle)) return "tiktok";
  if (/linkedin|lnkd\.in/.test(needle)) return "linkedin";
  if (/facebook|fb\.com|fb\.me|instagram|meta\.com/.test(needle)) return "facebook";
  if (/google|goog\.gl|bing|duckduckgo|qwant|ecosia|yahoo/.test(needle)) return "google";
  return null;
}

export interface AcquisitionInput {
  referrer: string | null | undefined;
  utmSource: string | null | undefined;
  utmMedium: string | null | undefined;
  /** Paramètre `?ref=` ou cookie d'attribution partenaire. */
  partnerRef: string | null | undefined;
  /** Hôte du site, pour ignorer les referrers internes. */
  siteHost?: string;
}

/**
 * Source d'acquisition de la visite en cours. Priorité : partenaire → QR →
 * utm_source → referrer → accès direct. Retourne toujours une clé connue.
 */
export function detectAcquisition(input: AcquisitionInput): string {
  const utm = (input.utmSource ?? "").trim().toLowerCase();
  const medium = (input.utmMedium ?? "").trim().toLowerCase();

  if (utm === "qr" || medium === "qr" || medium === "qrcode") return "qr";
  if (input.partnerRef) return "partner";
  if (utm) return classifyHost(utm) ?? "other";

  const ref = (input.referrer ?? "").trim();
  if (!ref) return "direct";
  let host = ref.toLowerCase();
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    // referrer non parsable : on classe sur la chaîne brute.
  }
  const site = (input.siteHost ?? "").replace(/^https?:\/\//, "").toLowerCase();
  if (site && host.endsWith(site)) return "direct";
  return classifyHost(host) ?? "other";
}

/**
 * Segment d'audience servi au moteur. Un seul segment par session : c'est
 * l'axe de personnalisation, il doit être déterministe et exclusif.
 */
export function detectSegment(input: {
  isAuthenticated: boolean;
  source: string;
  visitCount: number;
}): SegmentKey {
  if (input.isAuthenticated) return "member";
  switch (input.source) {
    case "partner":
      return "partner";
    case "qr":
      return "qr";
    case "tiktok":
      return "tiktok";
    case "facebook":
      return "facebook";
    case "linkedin":
      return "linkedin";
    case "google":
      return "google";
    case "other":
      return input.visitCount > 1 ? "returning" : "other";
    default:
      return input.visitCount > 1 ? "returning" : "direct";
  }
}

/** Famille d'appareil déduite du user-agent (jamais la chaîne complète). */
export function detectDevice(userAgent: string | null | undefined): DeviceKey {
  const ua = userAgent ?? "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Langue principale demandée par le navigateur (`fr`, `en`…). */
export function detectLanguage(acceptLanguage: string | null | undefined): string {
  const raw = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const lang = raw.split("-")[0] ?? "";
  return /^[a-z]{2}$/.test(lang) ? lang : "fr";
}

/**
 * Robots d'indexation et aperçus de partage : ils doivent voir la version de
 * RÉFÉRENCE (contenu canonique) et ne jamais entrer dans l'expérimentation.
 */
export function isCrawler(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return true;
  return /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|discord|lighthouse|headlesschrome|gtmetrix|pagespeed|semrush|ahrefs|screaming frog/.test(
    ua
  );
}

/** Profil de repli servi aux robots et quand l'identité est absente. */
export function crawlerProfile(): VisitorProfile {
  return {
    visitorId: "",
    segment: "direct",
    source: "direct",
    device: "desktop",
    country: null,
    language: "fr",
    isReturning: false,
    isAuthenticated: false,
    visitCount: 1,
    partnerRef: null,
  };
}
