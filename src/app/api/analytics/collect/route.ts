import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  clientIp,
  detectDevice,
  detectSource,
  geoFromHeaders,
  isBotPath,
  recordPageView,
  sanitizePath,
  visitorHash,
} from "@/lib/analytics/server";
import { isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/analytics/collect — beacon PUBLIC d'enregistrement d'une page vue.
 *
 * Ne renvoie AUCUNE donnée. N'accepte QUE des pages vues (les événements
 * métier sont écrits côté serveur / par trigger, jamais depuis le client).
 * RGPD : identité visiteur = hash non réversible (IP+UA salés), aucune IP en
 * clair, cookieless. Rate-limité par visiteur. Chemins /admin et /api ignorés.
 */
export async function POST(request: Request) {
  // Sans clé secrète serveur, aucune écriture possible : on l'ignore en silence.
  if (!isAdminConfigured) return NextResponse.json({ ok: true, skipped: true });

  let body: { path?: unknown; referrer?: unknown; utmSource?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = sanitizePath(typeof body.path === "string" ? body.path : "/");
  // On ne suit ni l'admin, ni les routes techniques.
  if (path.startsWith("/admin") || path.startsWith("/api") || isBotPath(path)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const headers = request.headers;
  const ua = headers.get("user-agent");
  const ip = clientIp(headers);
  const hash = visitorHash(ip, ua);

  // Anti-flood : max 40 pages vues par visiteur et par minute (garde-fou).
  if (!checkRateLimit(`analytics:${hash}`, 40, 60_000)) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  const { country, city } = geoFromHeaders(headers);
  await recordPageView({
    path,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    source: detectSource(
      typeof body.referrer === "string" ? body.referrer : null,
      typeof body.utmSource === "string" ? body.utmSource : null
    ),
    device: detectDevice(ua),
    visitorHash: hash,
    country,
    city,
  });

  return NextResponse.json({ ok: true });
}
