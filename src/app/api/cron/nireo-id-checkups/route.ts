import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured } from "@/lib/email/provider";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { runDueCheckups } from "@/features/nireo-id/server/checkups";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST/GET /api/cron/nireo-id-checkups — bilans dus du jour (Nireo ID).
 *
 * À appeler UNE fois par jour avec `Authorization: Bearer ${CRON_SECRET}`.
 * GET est accepté : Vercel Cron invoque les routes en GET et ajoute
 * automatiquement l'en-tête lorsque CRON_SECRET est défini.
 *
 * Garde-fous :
 *  • inactif (503 explicite) sans CRON_SECRET ou sans clé serveur Supabase ;
 *  • idempotent : une seule demande par téléphone et par échéance
 *    (index unique en base) — relancer le cron n'envoie aucun doublon ;
 *  • sans fournisseur e-mail, RIEN n'est marqué « envoyé » : la demande
 *    passe en « lien à transmettre » et reste visible dans l'interface.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "provider_not_configured : CRON_SECRET absent — bilans automatiques inactifs." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "provider_not_configured : clé serveur Supabase manquante — aucun traitement." },
      { status: 503 }
    );
  }

  try {
    const result = await runDueCheckups();
    return NextResponse.json({
      ...result,
      email_provider: isEmailProviderConfigured ? "configure" : "absent",
    });
  } catch (error) {
    logger.error("cron/nireo-id-checkups", error);
    return NextResponse.json({ error: "Traitement interrompu." }, { status: 500 });
  }
}

/** Vercel Cron appelle en GET : même traitement, mêmes garde-fous. */
export const GET = POST;
