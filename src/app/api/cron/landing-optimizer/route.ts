import { NextResponse } from "next/server";
import { getCapabilitiesFresh, getLandingConfigFresh } from "@/lib/landing/config";
import { recomputeWeights } from "@/lib/landing/engine";
import { generateRecommendations } from "@/lib/landing/recommendations";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Rétention des événements bruts : 180 jours (l'historique agrégé reste). */
const RETENTION_DAYS = 180;

/**
 * POST/GET /api/cron/landing-optimizer — cycle d'apprentissage de la vitrine.
 *
 * Trois opérations, dans cet ordre :
 *   1. rééquilibrage de la répartition du trafic (si le pilote automatique
 *      est actif) — il ne fait que déplacer du trafic entre variantes déjà
 *      validées, jamais créer ni supprimer de contenu ;
 *   2. régénération des recommandations à partir des données réelles ;
 *   3. purge des événements bruts trop anciens.
 *
 * À appeler avec `Authorization: Bearer ${CRON_SECRET}` (voir vercel.json).
 * Aucune donnée n'est inventée : sans trafic, la route ne fait rien et le
 * dit explicitement dans sa réponse.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "provider_not_configured : CRON_SECRET absent — optimisation inactive." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "provider_not_configured : clé secrète Supabase manquante." },
      { status: 503 }
    );
  }

  const result = {
    rebalanced: false as boolean | string,
    version: null as number | null,
    recommendations: 0,
    pruned: 0,
  };

  try {
    const [config, capabilities] = await Promise.all([
      getLandingConfigFresh(),
      getCapabilitiesFresh(),
    ]);

    // 1. Pilote automatique — jamais appelé si l'administration l'a coupé.
    if (config.autopilot) {
      const updated = await recomputeWeights(null, "autopilot");
      result.rebalanced = updated !== null;
      result.version = updated?.version ?? config.version;
    } else {
      result.rebalanced = "autopilot_off";
      result.version = config.version;
    }

    // 2. Recommandations (toujours régénérées : elles n'appliquent rien).
    const analysis = await generateRecommendations(
      result.version && result.version !== config.version ? await getLandingConfigFresh() : config,
      capabilities
    );
    result.recommendations = analysis.total;

    // 3. Rétention.
    const { data: pruned, error } = await createAdminClient().rpc("landing_prune_events", {
      p_days: RETENTION_DAYS,
    });
    if (error) throw new Error(error.message);
    result.pruned = Number(pruned ?? 0);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    logger.error("cron/landing-optimizer", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Optimisation interrompue.", ...result },
      { status: 500 }
    );
  }
}

/** Vercel Cron appelle en GET : même traitement, mêmes garde-fous. */
export const GET = POST;
