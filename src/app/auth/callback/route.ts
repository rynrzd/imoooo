import { NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import { welcomeEmail } from "@/lib/email/templates";
import { attachPartnerAttribution, REF_COOKIE_NAME } from "@/lib/marketing/referral";
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

/** Valeur d'un cookie depuis l'en-tête brut (route handler sans NextRequest). */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Attribution partenaire : si le navigateur porte le cookie `nireo_ref`
 * (posé par le proxy lors d'une arrivée via lien/QR partenaire), le compte
 * fraîchement confirmé est rattaché au partenaire — first-touch, self-
 * referral et comptes admin refusés côté SQL. Jamais bloquant.
 */
async function attachReferralOnSignup(
  supabase: SupabaseClient,
  request: Request
): Promise<void> {
  try {
    const cookieValue = readCookie(request, REF_COOKIE_NAME);
    if (!cookieValue) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return;
    // [diag/marketing] TEMPORAIRE — rattachement au partenaire à la confirmation.
    const attach = await attachPartnerAttribution(user.id, cookieValue);
    logger.info(
      "diag/marketing",
      `signup · user=${user.id} attribution attached=${attach.attached}${attach.reason ? ` reason=${attach.reason}` : ""}`
    );
  } catch (e) {
    logger.error("auth/callback attribution partenaire", e);
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
      // Confirmation d'inscription : e-mail de bienvenue (une seule fois)
      // + rattachement au partenaire si arrivée via lien/QR partenaire.
      if (type === "signup" || type === "email") {
        await sendWelcomeOnce(supabase);
        await attachReferralOnSignup(supabase, request);
      }
      return redirect(safeNext);
    }
    exchangeError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await attachReferralOnSignup(supabase, request);
      return redirect(safeNext);
    }
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
