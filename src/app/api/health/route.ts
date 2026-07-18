import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/health — sonde de vie minimale, sans Supabase ni variable
 * d'environnement. Sert à vérifier qu'un déploiement sert bien le routing
 * Next.js (diagnostic Vercel) et à brancher un monitoring externe.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "immopilot" });
}
