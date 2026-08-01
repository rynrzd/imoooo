import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/admin/auth";
import { getLandingSnapshot, isLandingRange } from "@/lib/landing/queries";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/admin/landing?range=24h|7d|30d|90d — photographie du moteur.
 * Réservé aux administrateurs (rôle vérifié en base, jamais côté client).
 */
export async function GET(request: Request) {
  try {
    await requireAdminAction();
  } catch {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const raw = new URL(request.url).searchParams.get("range");
  const range = isLandingRange(raw) ? raw : "7d";

  try {
    const snapshot = await getLandingSnapshot(range);
    return NextResponse.json(snapshot, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logger.error("admin/landing api", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lecture impossible." },
      { status: 500 }
    );
  }
}
