import { NextResponse } from "next/server";
import {
  isMonitoringConfigured,
  MONITORING_ENVIRONMENT,
  MONITORING_RELEASE,
} from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — sonde de vie, et seul endroit où l'on peut CONSTATER
 * qu'un déploiement est celui qu'on croit.
 *
 * `monitoring: false` signifie que les erreurs ne partent nulle part : ce
 * n'est pas un détail de configuration, c'est l'écart entre « on saura » et
 * « on ne saura pas ». La sonde le dit donc à voix haute.
 *
 * Aucune valeur secrète n'est exposée : uniquement des booléens, le nom de
 * l'environnement et le commit déployé — trois informations que la réponse
 * HTTP trahit déjà par ailleurs, et sans lesquelles aucun diagnostic à
 * distance n'est possible.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: "nireo",
    environment: MONITORING_ENVIRONMENT,
    release: MONITORING_RELEASE,
    monitoring: isMonitoringConfigured,
  });
}
