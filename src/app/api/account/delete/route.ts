import { NextResponse } from "next/server";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CONFIRMATION_SENTENCE = "SUPPRIMER MON COMPTE";
const BUCKETS = [
  "property-documents",
  "property-photos",
  "expense-receipts",
  "profile-avatars",
  "maintenance-files",
] as const;

/**
 * POST /api/account/delete — suppression DÉFINITIVE du compte.
 * Sécurité : session requise + phrase de confirmation + mot de passe
 * revérifié. Exécution serveur uniquement (clé secrète) : fichiers
 * Storage puis utilisateur Auth (les lignes métier suivent en cascade).
 */
export async function POST(request: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Suppression indisponible : SUPABASE_SECRET_KEY n'est pas configurée côté serveur. " +
          "Contactez le support pour une suppression manuelle.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  }

  let confirmation: unknown;
  let password: unknown;
  try {
    ({ confirmation, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (confirmation !== CONFIRMATION_SENTENCE) {
    return NextResponse.json(
      { error: `Saisissez exactement la phrase « ${CONFIRMATION_SENTENCE} ».` },
      { status: 400 }
    );
  }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
  }

  // Anti-abus : 3 tentatives par minute et par compte.
  if (!checkRateLimit(`account-delete:${user.id}`, 3, 60_000)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Patientez une minute puis réessayez." },
      { status: 429 }
    );
  }

  // Réauthentification réelle : le mot de passe doit être valide.
  const { url, publishableKey } = getSupabaseEnv();
  const verifier = createBareClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
  }

  try {
    const admin = createAdminClient();

    // 1. Abonnement Stripe : résilié AVANT toute suppression, sinon le
    // client continuerait d'être facturé après la disparition du compte.
    const { data: subscription, error: subError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subError) throw new Error(`Lecture de l'abonnement impossible : ${subError.message}`);

    const BILLABLE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];
    if (
      subscription?.stripe_subscription_id &&
      BILLABLE_STATUSES.includes(subscription.status)
    ) {
      if (!isStripeConfigured) {
        return NextResponse.json(
          {
            error:
              "Un abonnement actif est associé à ce compte mais Stripe n'est pas configuré côté serveur. " +
              "Résiliez d'abord votre abonnement, puis réessayez.",
          },
          { status: 503 }
        );
      }
      try {
        await getStripe().subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeError) {
        // Abonnement déjà résilié / introuvable côté Stripe : rien à annuler.
        const code =
          typeof stripeError === "object" && stripeError !== null && "code" in stripeError
            ? (stripeError as { code?: string }).code
            : undefined;
        if (code !== "resource_missing") {
          logger.error("account/delete", stripeError);
          return NextResponse.json(
            {
              error:
                "La résiliation de votre abonnement Stripe a échoué. Votre compte n'a pas été supprimé : " +
                "réessayez ou contactez le support.",
            },
            { status: 502 }
          );
        }
      }
    }

    // 2. Fichiers Storage ({userId}/{dossier}/{fichier} — 2 niveaux max).
    for (const bucket of BUCKETS) {
      const paths: string[] = [];
      const { data: level1 } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
      for (const entry of level1 ?? []) {
        if (entry.id) {
          paths.push(`${user.id}/${entry.name}`);
        } else {
          const { data: level2 } = await admin.storage
            .from(bucket)
            .list(`${user.id}/${entry.name}`, { limit: 1000 });
          for (const file of level2 ?? []) {
            paths.push(`${user.id}/${entry.name}/${file.name}`);
          }
        }
      }
      if (paths.length > 0) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw new Error(`Storage ${bucket} : ${error.message}`);
      }
    }

    // 3. Utilisateur Auth — les tables métier suivent (on delete cascade).
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(deleteError.message);

    logger.warn("account/delete", `Compte supprimé (${user.id})`);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    logger.error("account/delete", e);
    return NextResponse.json(
      { error: "La suppression a été interrompue avant la fin. Votre compte existe toujours : réessayez ou contactez le support." },
      { status: 500 }
    );
  }
}
