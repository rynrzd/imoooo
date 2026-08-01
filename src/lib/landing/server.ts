import { cache } from "react";
import { cookies, headers } from "next/headers";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/config";
import {
  crawlerProfile,
  detectAcquisition,
  detectDevice,
  detectLanguage,
  detectSegment,
  isCrawler,
  isValidVisitorId,
  parseVisit,
  PARTNER_COOKIE,
  VISIT_COOKIE,
  VISITOR_COOKIE,
} from "./audience";
import { getEngineState } from "./config";
import { resolveLanding } from "./resolve";
import type { LandingEventType, LandingResolution, VisitorProfile } from "./types";

/**
 * Landing Intelligence — CÔTÉ SERVEUR.
 *
 * Deux responsabilités :
 *   1. construire le profil du visiteur et résoudre la page (rendu serveur) ;
 *   2. écrire les événements en base (ingestion + conversions confirmées).
 *
 * Les conversions (`signup_completed`, `payment_started`, `payment_success`)
 * ne sont JAMAIS acceptées depuis le navigateur : elles sont écrites ici,
 * à partir d'une session vérifiée ou d'un webhook Stripe signé. C'est ce qui
 * garantit que les taux de conversion affichés sont réels.
 */

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Présence d'une session Supabase (cookie `sb-…-auth-token`). */
function hasAuthCookie(all: { name: string; value: string }[]): boolean {
  return all.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value.length > 0);
}

/**
 * Profil du visiteur courant, déduit des en-têtes et des cookies posés par
 * le proxy. Mémorisé pour la durée de la requête (`cache`) : appelé par la
 * page et par les métadonnées sans jamais recalculer.
 */
export const getVisitorProfile = cache(async (): Promise<VisitorProfile> => {
  const [h, jar] = await Promise.all([headers(), cookies()]);
  const userAgent = h.get("user-agent");

  // Robots : contenu canonique, aucune personnalisation, aucun suivi.
  if (isCrawler(userAgent)) return crawlerProfile();

  const visitorId = jar.get(VISITOR_COOKIE)?.value ?? "";
  const visit = parseVisit(jar.get(VISIT_COOKIE)?.value);
  const partnerRef = jar.get(PARTNER_COOKIE)?.value?.split("|")[0] ?? null;
  const isAuthenticated = hasAuthCookie(jar.getAll());

  // La source est figée par le proxy au début de la visite ; sans cookie
  // (tout premier affichage), on la déduit du referrer de cette requête.
  const source =
    visit?.source ??
    detectAcquisition({
      referrer: h.get("referer"),
      utmSource: null,
      utmMedium: null,
      partnerRef,
      siteHost: SITE_HOST,
    });
  const visitCount = visit?.count ?? 1;

  return {
    visitorId: isValidVisitorId(visitorId) ? visitorId : "",
    segment: detectSegment({ isAuthenticated, source, visitCount }),
    source,
    device: detectDevice(userAgent),
    country: (h.get("x-vercel-ip-country") || "").trim().toUpperCase() || null,
    language: detectLanguage(h.get("accept-language")),
    isReturning: visitCount > 1,
    isAuthenticated,
    visitCount,
    partnerRef: partnerRef || null,
  };
});

/**
 * Résolution complète de la landing pour la requête en cours.
 * Une seule fois par requête, même si plusieurs composants l'utilisent.
 */
export const getLandingResolution = cache(async (): Promise<LandingResolution> => {
  const [profile, state] = await Promise.all([getVisitorProfile(), getEngineState()]);
  return resolveLanding(profile, state);
});

/* ------------------------------------------------------------------ */
/*  Écriture des événements                                            */
/* ------------------------------------------------------------------ */

export interface LandingEventInput {
  eventType: LandingEventType;
  visitorId: string;
  sessionId?: string | null;
  path?: string;
  segment?: string | null;
  source?: string | null;
  device?: string | null;
  country?: string | null;
  language?: string | null;
  isReturning?: boolean | null;
  visitCount?: number | null;
  assignments?: Record<string, string>;
  configVersion?: number | null;
  slot?: string | null;
  variant?: string | null;
  section?: string | null;
  element?: string | null;
  value?: number | null;
  meta?: Record<string, unknown> | null;
  userId?: string | null;
}

function toRow(input: LandingEventInput) {
  return {
    event_type: input.eventType,
    visitor_id: input.visitorId,
    session_id: input.sessionId ?? null,
    path: input.path ?? "/",
    segment: input.segment ?? null,
    source: input.source ?? null,
    device: input.device ?? null,
    country: input.country ?? null,
    language: input.language ?? null,
    is_returning: input.isReturning ?? null,
    visit_count: input.visitCount ?? null,
    assignments: input.assignments ?? {},
    config_version: input.configVersion ?? null,
    slot: input.slot ?? null,
    variant: input.variant ?? null,
    section: input.section ?? null,
    element: input.element ?? null,
    value: typeof input.value === "number" && Number.isFinite(input.value) ? input.value : null,
    meta: input.meta ?? null,
    user_id: input.userId ?? null,
  };
}

/** Insertion groupée, best-effort : le suivi ne casse jamais la navigation. */
export async function recordLandingEvents(events: LandingEventInput[]): Promise<void> {
  if (!isAdminConfigured || events.length === 0) return;
  try {
    const { error } = await createAdminClient()
      .from("landing_events")
      .insert(events.map(toRow));
    if (error) throw new Error(error.message);
  } catch (e) {
    logger.error("landing/events", e);
  }
}

/* ------------------------------------------------------------------ */
/*  Conversions confirmées (serveur uniquement)                       */
/* ------------------------------------------------------------------ */

interface Attribution {
  visitorId: string;
  sessionId: string | null;
  assignments: Record<string, string>;
  segment: string | null;
  source: string | null;
  device: string | null;
  country: string | null;
  configVersion: number | null;
}

/** Dernière combinaison réellement servie à ce visiteur (ou `null`). */
async function lastExposure(visitorId: string): Promise<Attribution | null> {
  if (!isAdminConfigured || !visitorId) return null;
  const { data, error } = await createAdminClient()
    .from("landing_events")
    .select("visitor_id, session_id, assignments, segment, source, device, country, config_version")
    .eq("visitor_id", visitorId)
    .eq("event_type", "exposure")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    visitorId: data.visitor_id as string,
    sessionId: (data.session_id as string | null) ?? null,
    assignments: (data.assignments as Record<string, string>) ?? {},
    segment: (data.segment as string | null) ?? null,
    source: (data.source as string | null) ?? null,
    device: (data.device as string | null) ?? null,
    country: (data.country as string | null) ?? null,
    configVersion: (data.config_version as number | null) ?? null,
  };
}

/** Attribution d'un utilisateur déjà converti (pour chaîner les conversions). */
async function attributionOfUser(userId: string): Promise<Attribution | null> {
  if (!isAdminConfigured) return null;
  const { data, error } = await createAdminClient()
    .from("landing_events")
    .select("visitor_id, session_id, assignments, segment, source, device, country, config_version")
    .eq("user_id", userId)
    .eq("event_type", "signup_completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    visitorId: data.visitor_id as string,
    sessionId: (data.session_id as string | null) ?? null,
    assignments: (data.assignments as Record<string, string>) ?? {},
    segment: (data.segment as string | null) ?? null,
    source: (data.source as string | null) ?? null,
    device: (data.device as string | null) ?? null,
    country: (data.country as string | null) ?? null,
    configVersion: (data.config_version as number | null) ?? null,
  };
}

/**
 * « Compte créé » — appelé depuis une route SERVEUR après vérification de la
 * session Supabase (l'utilisateur existe vraiment). L'index unique en base
 * garantit qu'un compte n'est jamais compté deux fois.
 */
export async function recordSignupConversion(
  userId: string,
  visitorId: string,
  /** Date de création du compte : au-delà de 24 h, ce n'est plus une conversion. */
  createdAt?: string | null
): Promise<void> {
  if (!isAdminConfigured) return;
  if (createdAt) {
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created) || Date.now() - created > 24 * 3600 * 1000) return;
  }
  try {
    const attribution = await lastExposure(visitorId);
    // Sans exposition connue, la conversion n'est rattachable à aucune
    // variante : on l'enregistre quand même (le tunnel global reste juste),
    // mais sans inventer d'assignation.
    const { error } = await createAdminClient().from("landing_events").insert(
      toRow({
        eventType: "signup_completed",
        visitorId: attribution?.visitorId ?? visitorId,
        sessionId: attribution?.sessionId ?? null,
        assignments: attribution?.assignments ?? {},
        segment: attribution?.segment ?? null,
        source: attribution?.source ?? null,
        device: attribution?.device ?? null,
        country: attribution?.country ?? null,
        configVersion: attribution?.configVersion ?? null,
        userId,
      })
    );
    // 23505 = doublon (l'utilisateur avait déjà été compté) : comportement normal.
    if (error && error.code !== "23505") throw new Error(error.message);
  } catch (e) {
    logger.error("landing/signup-conversion", e);
  }
}

/**
 * « Paiement démarré » / « Paiement confirmé » — appelés côté serveur
 * (checkout Stripe, webhook signé). L'attribution est reprise de la
 * conversion d'inscription : jamais de donnée inventée.
 */
export async function recordPaymentConversion(
  eventType: "payment_started" | "payment_success",
  userId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  if (!isAdminConfigured) return;
  try {
    const attribution = await attributionOfUser(userId);
    if (!attribution) return; // visiteur non issu de la landing instrumentée
    const { error } = await createAdminClient().from("landing_events").insert(
      toRow({
        eventType,
        visitorId: attribution.visitorId,
        sessionId: attribution.sessionId,
        assignments: attribution.assignments,
        segment: attribution.segment,
        source: attribution.source,
        device: attribution.device,
        country: attribution.country,
        configVersion: attribution.configVersion,
        userId,
        meta: meta ?? null,
      })
    );
    if (error) throw new Error(error.message);
  } catch (e) {
    logger.error(`landing/${eventType}`, e);
  }
}
