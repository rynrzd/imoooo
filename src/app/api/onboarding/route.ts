import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  clampOnboardingStep,
  isOnboardingAction,
  ONBOARDING_VERSION,
} from "@/lib/onboarding";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/onboarding — persiste la progression de l'assistant de bienvenue
 * de l'utilisateur CONNECTÉ.
 *
 * Corps : { action: "step" | "skip" | "complete", step?: number }
 *
 * Robustesse : l'écriture passe par la clé secrète (client admin) et vise
 * STRICTEMENT la ligne de l'utilisateur authentifié — l'`id` provient de la
 * session vérifiée côté serveur, jamais du navigateur. L'opération est ainsi
 * indépendante des privilèges par colonne (la vraie cause du bug d'origine) et
 * insensible à l'ordre des migrations de droits. Un `upsert` défensif couvre
 * le cas — improbable — où la ligne `profiles` n'existe pas encore.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  }

  let body: { action?: unknown; step?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!isOnboardingAction(body.action)) {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
  const action = body.action;
  // Étape bornée CÔTÉ SERVEUR (jamais fixée librement par le navigateur).
  const step = clampOnboardingStep(body.step);

  if (!isAdminConfigured) {
    // Sans clé secrète, aucune persistance fiable possible : on le signale
    // clairement plutôt que de faire échouer silencieusement l'écriture.
    logger.error("onboarding/persist", "SUPABASE_SECRET_KEY absente");
    return NextResponse.json(
      { error: "Enregistrement indisponible pour le moment." },
      { status: 503 }
    );
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    id: user.id,
    onboarding_current_step: step,
    onboarding_version: ONBOARDING_VERSION,
    // Renseigné à la 1re avancée uniquement ; les upserts suivants ne
    // l'incluent pas, donc la date de début est préservée.
    ...(action === "step" && step === 1 ? { onboarding_started_at: nowIso } : {}),
    ...(action === "skip" ? { onboarding_skipped: true, onboarding_skipped_at: nowIso } : {}),
    ...(action === "complete"
      ? { onboarding_completed: true, onboarding_completed_at: nowIso }
      : {}),
  };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").upsert(patch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, onboardingVersion: ONBOARDING_VERSION });
  } catch (e) {
    // Détail technique journalisé côté serveur uniquement (jamais exposé).
    logger.error(`onboarding/persist user=${user.id} action=${action}`, e);
    return NextResponse.json(
      { error: "Enregistrement impossible. Réessayez." },
      { status: 500 }
    );
  }
}
