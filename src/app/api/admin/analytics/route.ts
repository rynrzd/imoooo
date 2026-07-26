import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/admin/auth";
import { getAnalyticsSnapshot, isAnalyticsRange } from "@/lib/analytics/queries";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics?range=24h|7d|30d|12m — statistiques réelles.
 *
 * Sécurité : rôle administrateur vérifié EN BASE (clé secrète, table
 * admin_users) avant toute lecture. Un utilisateur normal reçoit 403, même
 * en appelant directement l'URL. Utilisé par le rafraîchissement automatique.
 */
export async function GET(request: Request) {
  try {
    await requireAdminAction();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Accès administrateur requis." },
      { status: 403 }
    );
  }

  const rangeParam = new URL(request.url).searchParams.get("range");
  const range = isAnalyticsRange(rangeParam) ? rangeParam : "7d";

  try {
    const snapshot = await getAnalyticsSnapshot(range);
    return NextResponse.json(snapshot);
  } catch (e) {
    logger.error("api/admin/analytics", e);
    return NextResponse.json(
      { error: "Statistiques indisponibles pour le moment." },
      { status: 500 }
    );
  }
}
