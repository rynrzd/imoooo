import { NextResponse } from "next/server";
import { captureFromBrowser, isMonitoringConfigured } from "@/lib/monitoring";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/monitoring/report — relais des erreurs survenues DANS LE
 * NAVIGATEUR (error boundaries, appels réseau échoués).
 *
 * Pourquoi passer par le serveur plutôt qu'envoyer directement au
 * collecteur : l'URL du collecteur contient généralement un jeton
 * d'ingestion. La publier dans le bundle client reviendrait à laisser
 * n'importe qui inonder la supervision.
 *
 * Volontairement PUBLIC (une erreur peut frapper un visiteur non connecté,
 * et c'est justement le cas qu'on ne voit jamais autrement), donc traité
 * comme une entrée hostile :
 *  • limité à 10 rapports par minute et par IP ;
 *  • corps borné à 16 Ko ;
 *  • contenu ré-expurgé côté serveur (jetons, e-mails, clés) ;
 *  • réponse toujours 204, sans détail : ce point d'entrée ne renseigne
 *    personne sur l'état de la supervision.
 */

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  // Réponse identique que la supervision soit active ou non.
  if (!isMonitoringConfigured) return new NextResponse(null, { status: 204 });

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRateLimit(`monitoring:${ip}`, 10, 60_000)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 });
    await captureFromBrowser(JSON.parse(raw));
  } catch {
    // Corps illisible : on ignore. Jamais d'erreur renvoyée — sinon un
    // rapport d'erreur raté produirait lui-même une erreur.
  }
  return new NextResponse(null, { status: 204 });
}
