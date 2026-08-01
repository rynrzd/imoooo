import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getEngineState } from "@/lib/landing/config";
import { resolveLanding } from "@/lib/landing/resolve";
import { getVisitorProfile, recordLandingEvents, type LandingEventInput } from "@/lib/landing/server";
import { isClientEventType } from "@/lib/landing/types";
import { isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/landing/collect — ingestion PUBLIQUE du comportement réel.
 *
 * Points de sécurité :
 * - l'identité du visiteur vient du COOKIE serveur, jamais du corps de la
 *   requête : impossible d'usurper un visiteur ;
 * - la combinaison de variantes est RECALCULÉE ici (assignation
 *   déterministe) : le client ne peut pas déclarer avoir vu autre chose que
 *   ce qui lui a réellement été servi ;
 * - seuls les événements comportementaux sont acceptés. Les conversions
 *   (compte créé, paiement) sont écrites ailleurs, à partir d'une session
 *   vérifiée ou d'un webhook signé.
 *
 * RGPD : aucune donnée personnelle, aucune coordonnée absolue, aucun contenu
 * de formulaire. Les positions de clic sont relatives (0–1).
 */

/** Nombre maximal d'événements par envoi (le tracker regroupe ses mesures). */
const MAX_EVENTS = 40;
/** Garde-fou : 240 événements par visiteur et par minute. */
const RATE_LIMIT = 240;

function clamp01(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean.length > 0 ? clean : null;
}

export async function POST(request: Request) {
  // Sans clé secrète serveur, aucune écriture possible : on l'ignore en silence.
  if (!isAdminConfigured) return NextResponse.json({ ok: true, skipped: true });

  let body: { sessionId?: unknown; path?: unknown; events?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const profile = await getVisitorProfile();
  // Pas d'identité (robot, cookies refusés) : rien n'est mesuré.
  if (!profile.visitorId) return NextResponse.json({ ok: true, skipped: true });

  if (!checkRateLimit(`landing:${profile.visitorId}`, RATE_LIMIT, 60_000)) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  const rawEvents = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  if (rawEvents.length === 0) return NextResponse.json({ ok: true });

  // Vérité serveur : on recalcule ce que ce visiteur a réellement reçu.
  const state = await getEngineState();
  const resolution = resolveLanding(profile, state);

  const sessionId = str(body.sessionId, 64);
  const path = str(body.path, 200) ?? "/";

  const events: LandingEventInput[] = [];
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (!isClientEventType(o.type)) continue;

    const x = clamp01(o.x);
    const y = clamp01(o.y);
    const value = Number(o.value);

    events.push({
      eventType: o.type,
      visitorId: profile.visitorId,
      sessionId,
      path,
      segment: profile.segment,
      source: profile.source,
      device: profile.device,
      country: profile.country,
      language: profile.language,
      isReturning: profile.isReturning,
      visitCount: profile.visitCount,
      assignments: resolution.assignments,
      configVersion: resolution.configVersion,
      section: str(o.section, 40),
      element: str(o.element, 60),
      slot: str(o.slot, 40),
      variant: str(o.variant, 40),
      value: Number.isFinite(value) ? Math.min(100_000, Math.max(0, value)) : null,
      // L'exposition mémorise si la personnalisation a joué : c'est ce qui
      // permet de comparer plus tard au groupe témoin.
      meta:
        o.type === "exposure"
          ? { personalized: resolution.personalized }
          : x !== null && y !== null
            ? { x, y }
            : null,
    });
  }

  await recordLandingEvents(events);
  return NextResponse.json({ ok: true, count: events.length });
}
