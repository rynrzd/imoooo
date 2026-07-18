import { NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import { welcomeEmail } from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/** Codes GoTrue signifiant « lien expiré ou déjà utilisé » (message dédié). */
const EXPIRED_CODES = new Set([
  "otp_expired",
  "flow_state_expired",
  "flow_state_not_found",
]);

/**
 * E-mail de bienvenue envoyé à la PREMIÈRE confirmation du compte.
 * Idempotent (email_logs, dedupe_key unique par utilisateur) et jamais
 * bloquant : un échec d'envoi n'empêche jamais la connexion.
 */
async function sendWelcomeOnce(supabase: SupabaseClient): Promise<void> {
  if (!isEmailProviderConfigured) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return;
    const content = welcomeEmail(
      (user.user_metadata?.full_name as string | undefined) ?? ""
    );
    // Réservation idempotente (RLS : l'utilisateur écrit sa propre ligne).
    const { error } = await supabase.from("email_logs").insert({
      user_id: user.id,
      kind: "welcome",
      recipient: user.email,
      subject: content.subject,
      status: "sent",
      dedupe_key: "welcome",
    });
    if (error) return; // déjà envoyé (contrainte unique) : rien à faire
    await sendEmail({ to: user.email, subject: content.subject, html: content.html });
  } catch (e) {
    logger.error("auth/callback welcome", e);
  }
}

/**
 * Callback d'authentification (confirmation d'e-mail, récupération de mot
 * de passe, changement d'e-mail). Deux formats de lien sont supportés :
 * - token hash (templates personnalisés, fiable sur tout appareil) :
 *   ?token_hash=…&type=… → verifyOtp()
 * - flux PKCE (OAuth, template par défaut) : ?code=… → exchangeCodeForSession()
 * Gère aussi : code absent, lien expiré/déjà utilisé, erreur GoTrue transmise
 * en query, utilisateur déjà confirmé, redirection invalide.
 * Messages français via /connexion?erreur=… — jamais d'erreur technique brute.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = OTP_TYPES.find((t) => t === rawType) ?? null;
  const gotrueErrorCode = searchParams.get("error_code");
  const hasGotrueError = Boolean(gotrueErrorCode || searchParams.get("error"));

  // Une récupération de mot de passe doit atterrir sur le formulaire dédié.
  const defaultNext = type === "recovery" ? "/reinitialiser-mot-de-passe" : "/";
  const next = searchParams.get("next") ?? defaultNext;
  // Sécurité : on ne redirige que vers des chemins internes.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`);
  const redirectError = (kind: "lien-expire" | "lien-invalide") =>
    redirect(`/connexion?erreur=${kind}`);

  if (!isSupabaseConfigured) {
    return redirectError("lien-invalide");
  }

  const supabase = await createClient();

  /** Session déjà valide et confirmée (lien re-cliqué, compte déjà confirmé) :
   * on poursuit vers l'application plutôt que d'afficher une erreur. */
  const hasConfirmedSession = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user && !user.is_anonymous && user.email_confirmed_at);
  };

  // GoTrue a transmis une erreur dans l'URL (lien expiré, déjà consommé…).
  if (hasGotrueError) {
    if (await hasConfirmedSession()) return redirect(safeNext);
    return redirectError(
      EXPIRED_CODES.has(gotrueErrorCode ?? "") ? "lien-expire" : "lien-invalide"
    );
  }

  let exchangeError: { code?: string; message: string } | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // Confirmation d'inscription : e-mail de bienvenue (une seule fois).
      if (type === "signup" || type === "email") await sendWelcomeOnce(supabase);
      return redirect(safeNext);
    }
    exchangeError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirect(safeNext);
    exchangeError = error;
  }

  if (exchangeError && process.env.NODE_ENV === "development") {
    console.warn(
      "[auth/callback]",
      exchangeError.code ?? "?",
      exchangeError.message
    );
  }

  // Échec d'échange (ou lien sans code) : si le compte est en réalité déjà
  // confirmé dans ce navigateur, on continue au lieu de bloquer.
  if (await hasConfirmedSession()) return redirect(safeNext);

  return redirectError(
    exchangeError?.code && EXPIRED_CODES.has(exchangeError.code)
      ? "lien-expire"
      : "lien-invalide"
  );
}
