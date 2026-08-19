import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Attribution partenaire — SERVEUR uniquement.
 *
 * Règle unique du projet : PREMIER partenaire attribué (first-touch).
 * - Le cookie d'attribution n'est jamais écrasé tant qu'il est valide.
 * - La ligne partner_attributions est unique par compte (jamais écrasée).
 *
 * Le cookie `nireo_ref` contient « ref|timestampMs|signature » (HttpOnly).
 * Sa durée de vie = attribution_window_days du partenaire (30 jours par
 * défaut) — et c'est ELLE, pas une vérification en base, qui borne la
 * fenêtre d'attribution : la fonction SQL ne relit jamais first_click_at
 * pour décider, elle ne fait que l'enregistrer.
 */

export const REF_COOKIE_NAME = "nireo_ref";
export const REF_PARAM = "ref";
/** Fenêtre d'attribution par défaut (jours) si le partenaire n'en fixe pas. */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/** Format accepté pour un ref entrant (slug lisible ou code aléatoire). */
const REF_FORMAT = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,59}$/;

/** Robots et outils : leurs « clics » ne sont jamais comptés. */
const BOT_UA =
  /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|discord|preview|curl|wget|python-requests|headless/i;

export interface RefCookiePayload {
  ref: string;
  /** Date du premier clic (ms epoch). */
  ts: number;
  /**
   * true si la signature du cookie a été vérifiée. Les cookies posés avant
   * l'introduction de la signature n'en portent pas : ils restent acceptés
   * (les refuser ferait perdre à des partenaires des attributions
   * légitimes déjà en cours), mais leur date n'est pas enregistrée.
   */
  signed: boolean;
}

/** Ref nettoyé si le format est plausible, sinon null. */
export function sanitizeRef(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  return REF_FORMAT.test(value) ? value : null;
}

/**
 * Clé de signature du cookie d'attribution.
 *
 * Le cookie est `HttpOnly` : le JavaScript de la page ne peut ni le lire ni
 * l'écrire. Seul quelqu'un qui fabrique la requête à la main — dans SON
 * propre navigateur — peut donc le forger, pour s'attribuer lui-même à un
 * partenaire. La signature rend cette fabrication impossible et, surtout,
 * rend la date du premier clic digne de confiance.
 *
 * Sans secret configuré, on ne signe pas et on le dit : mieux vaut une
 * absence de signature assumée qu'une signature à clé connue, qui donnerait
 * l'illusion d'une protection.
 */
function signingKey(): string | null {
  // Plusieurs noms acceptés, du plus précis au plus général. `COOKIE_SECRET`
  // est un nom générique parfaitement raisonnable pour un secret de
  // signature de cookie : refuser de le lire ferait échouer la protection
  // en silence, pour une simple divergence de nommage.
  return (
    process.env.REF_COOKIE_SECRET?.trim() ||
    process.env.COOKIE_SECRET?.trim() ||
    process.env.REF_IP_SALT?.trim() ||
    null
  );
}

function signPayload(ref: string, ts: number): string | null {
  const key = signingKey();
  if (!key) return null;
  // 16 octets suffisent : falsifier une empreinte tronquée à 128 bits reste
  // hors de portée, et le cookie reste court.
  return createHmac("sha256", key).update(`${ref}|${ts}`).digest("hex").slice(0, 32);
}

export function serializeRefCookie(payload: { ref: string; ts: number }): string {
  const signature = signPayload(payload.ref, payload.ts);
  return signature
    ? `${payload.ref}|${payload.ts}|${signature}`
    : `${payload.ref}|${payload.ts}`;
}

export function parseRefCookie(value: string | null | undefined): RefCookiePayload | null {
  if (!value) return null;
  const [ref, ts, signature] = value.split("|");
  const cleanRef = sanitizeRef(ref);
  const time = Number(ts);
  if (!cleanRef || !Number.isFinite(time) || time <= 0) return null;

  let signed = false;
  if (signature) {
    const expected = signPayload(cleanRef, time);
    // Comparaison à temps constant : `timingSafeEqual` exige deux tampons de
    // même longueur, d'où la vérification préalable.
    if (expected && expected.length === signature.length) {
      signed = timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    // Signature présente mais invalide = cookie trafiqué, pas un ancien
    // cookie. On le rejette entièrement.
    if (!signed) return null;
  }

  return { ref: cleanRef, ts: time, signed };
}

/**
 * SHA-256 salé de l'IP — anti-fraude sans stocker de donnée personnelle.
 * Le sel vient de REF_IP_SALT (optionnel) : sans lui, un sel applicatif
 * fixe est utilisé (le hachage reste non réversible).
 */
export function hashIp(ip: string | null | undefined): string {
  const value = (ip ?? "").trim();
  if (!value) return "";
  const salt = process.env.REF_IP_SALT?.trim() || "nireo-referral-v1";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/** true si le user-agent ressemble à un robot (clic non compté). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA.test(userAgent);
}

/** User-agent réduit (famille navigateur/OS) — jamais la chaîne complète. */
export function simplifyUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Autre";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Autre";
  const mobile = /Mobile|Android|iPhone/.test(ua) ? " · mobile" : "";
  return `${browser} · ${os}${mobile}`;
}

export interface RecordClickResult {
  valid: boolean;
  counted?: boolean;
  slug?: string;
  windowDays?: number;
  reason?: string;
}

/**
 * Valide le partenaire côté serveur (existe, actif, dates) et enregistre
 * le clic (déduplication + plafond quotidien en SQL). Jamais bloquant :
 * en cas d'erreur, la navigation continue sans attribution.
 */
export async function recordPartnerClick(input: {
  ref: string;
  landingPage: string;
  source?: string;
  campaign?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<RecordClickResult> {
  if (!isAdminConfigured) return { valid: false, reason: "not_configured" };
  if (isBotUserAgent(input.userAgent)) return { valid: false, reason: "bot" };
  try {
    const { data, error } = await createAdminClient().rpc("record_partner_click", {
      p_ref: input.ref,
      p_landing: input.landingPage,
      p_source: input.source ?? "",
      p_campaign: input.campaign ?? "",
      p_ip_hash: hashIp(input.ip),
      p_user_agent: simplifyUserAgent(input.userAgent),
    });
    if (error) throw new Error(error.message);
    const result = data as {
      valid: boolean;
      counted?: boolean;
      slug?: string;
      window_days?: number;
      reason?: string;
    };
    return {
      valid: result.valid,
      counted: result.counted,
      slug: result.slug,
      windowDays: result.window_days,
      reason: result.reason,
    };
  } catch (e) {
    logger.error("[marketing/referral] enregistrement du clic", e);
    return { valid: false, reason: "error" };
  }
}

export interface AttachResult {
  attached: boolean;
  reason?: string;
}

/**
 * Rattache le compte au partenaire du cookie (first-touch, self-referral
 * et comptes admin refusés en SQL). Idempotent et jamais bloquant.
 */
export async function attachPartnerAttribution(
  userId: string,
  cookieValue: string | null | undefined
): Promise<AttachResult> {
  if (!isAdminConfigured) return { attached: false, reason: "not_configured" };
  const payload = parseRefCookie(cookieValue);
  if (!payload) return { attached: false, reason: "no_cookie" };
  try {
    const { data, error } = await createAdminClient().rpc("attach_partner_attribution", {
      p_user_id: userId,
      p_ref: payload.ref,
      // Date enregistrée SEULEMENT si elle est signée. Une date issue d'un
      // cookie non signé serait une donnée fournie par le visiteur : la
      // colonne resterait remplie, mais elle ne voudrait rien dire.
      p_first_click_at: payload.signed ? new Date(payload.ts).toISOString() : null,
    });
    if (error) throw new Error(error.message);
    const result = data as { attached: boolean; reason?: string };
    return { attached: result.attached, reason: result.reason };
  } catch (e) {
    logger.error("[marketing/referral] rattachement attribution", e);
    return { attached: false, reason: "error" };
  }
}

/** Lien public unique d'un partenaire — `https://nireo.fr/?ref=slug`. */
export function buildPartnerLink(slug: string): string {
  return `${SITE_URL}/?${REF_PARAM}=${encodeURIComponent(slug)}`;
}

/**
 * La signature du cookie d'attribution est-elle active ?
 * Exposé pour que l'administration puisse l'AFFICHER : sans secret, la
 * protection est absente et rien à l'écran ne le dirait autrement.
 */
export const isRefCookieSigned = signingKey() !== null;
