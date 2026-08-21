import { NextResponse } from "next/server";
import { logAdminLogin, logAdminAction } from "@/lib/admin/audit";
import { findAdminByUserId, getAdminContext } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { checkRateLimitShared } from "@/lib/rate-limit";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/admin/session — connexion administrateur.
 *
 * Sécurité :
 * - mot de passe vérifié par Supabase Auth côté serveur (jamais comparé
 *   à une valeur en dur, jamais stocké en clair) ;
 * - limitation des tentatives par IP ET par e-mail ;
 * - le rôle admin est vérifié en base (`admin_users`) : un compte client
 *   valide mais non admin est IMMÉDIATEMENT déconnecté (message générique) ;
 * - chaque tentative (réussie ou refusée) est journalisée dans l'audit.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured || !isAdminConfigured) {
    return NextResponse.json(
      { error: "Espace administrateur indisponible : configuration serveur incomplète." },
      { status: 503 }
    );
  }

  let email: unknown;
  let password: unknown;
  let captchaToken: unknown;
  try {
    ({ email, password, captchaToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "E-mail et mot de passe requis." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // Limitation des tentatives : 10 / 15 min par IP, 5 / 5 min par e-mail.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  // Compteur PARTAGÉ entre instances : c'est la surface où l'on devine un
  // mot de passe, une limite par instance s'y contourne en multipliant les
  // points d'entrée. Repli automatique sur la mémoire si la migration du
  // compteur commun n'est pas encore appliquée.
  if (
    !(await checkRateLimitShared(`admin-login-ip:${ip}`, 10, 15 * 60_000)) ||
    !(await checkRateLimitShared(`admin-login-email:${normalizedEmail}`, 5, 5 * 60_000))
  ) {
    return NextResponse.json(
      { error: "Trop de tentatives. Patientez quelques minutes puis réessayez." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  /*
   * JETON ANTI-ROBOT — indispensable, et pas seulement souhaitable.
   *
   * La protection CAPTCHA est activée sur le projet Supabase : GoTrue refuse
   * TOUT `signInWithPassword` sans jeton, y compris celui-ci, émis depuis le
   * serveur. La connexion administrateur avait donc cessé de fonctionner à
   * l'activation de Turnstile — un mot de passe correct était refusé
   * exactement comme un mauvais, et le message générique ci-dessous masquait
   * la vraie cause. Le formulaire fournit désormais son jeton, comme le fait
   * déjà la connexion client.
   *
   * L'objet reste VIDE quand la protection est inactive : l'appel est alors
   * identique à ce qu'il était.
   */
  const options = typeof captchaToken === "string" && captchaToken
    ? { captchaToken }
    : {};
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
    options,
  });
  if (error || !data.user) {
    // Distinguer un échec de PROTECTION d'un mauvais mot de passe — dans le
    // JOURNAL seulement. L'utilisateur, lui, garde un message unique : révéler
    // la différence permettrait d'énumérer les comptes.
    const captchaIssue = /captcha/i.test(error?.code ?? error?.message ?? "");
    if (captchaIssue) {
      logger.error(
        "admin/session",
        new Error(
          "Connexion administrateur refusée par la protection anti-robot " +
            `(${error?.code ?? "captcha"}). Jeton absent ou déjà consommé.`
        )
      );
    }
    await logAdminLogin(
      normalizedEmail,
      false,
      captchaIssue ? "Protection anti-robot : jeton absent ou invalide." : "Identifiants invalides."
    );
    if (captchaIssue) {
      /*
       * Un échec de la protection anti-robot est dit FRANCHEMENT, contrairement
       * à un mauvais mot de passe. Il ne révèle rien : il parle du navigateur,
       * jamais du compte — impossible d'en déduire qu'une adresse existe.
       *
       * L'annoncer évite précisément l'incident qui a motivé ce correctif :
       * un administrateur voyait « Identifiants invalides » et cherchait son
       * mot de passe pendant que la vraie cause était ailleurs.
       */
      return NextResponse.json(
        {
          error:
            "La vérification anti-robot n'a pas abouti. Patientez un instant puis réessayez.",
        },
        { status: 400 }
      );
    }
    // Message volontairement générique : ne révèle ni l'existence du compte
    // ni son éventuel statut administrateur.
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  let admin;
  try {
    admin = await findAdminByUserId(data.user.id);
  } catch (e) {
    logger.error("admin/session", e);
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Vérification administrateur impossible. Réessayez." },
      { status: 500 }
    );
  }

  // Vérification serveur STRICTE : ligne admin_users active ET rôle habilité
  // (owner, admin ou support). Tout autre compte — même valide — est
  // déconnecté immédiatement : la session ne survit jamais à un refus.
  if (!admin || !admin.is_active || !["owner", "admin", "support"].includes(admin.role)) {
    await supabase.auth.signOut();
    await logAdminLogin(
      normalizedEmail,
      false,
      admin ? "Rôle non habilité ou compte inactif." : "Compte non administrateur."
    );
    return NextResponse.json({ error: "Accès administrateur refusé." }, { status: 403 });
  }

  const { error: touchError } = await createAdminClient()
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", admin.id);
  if (touchError) logger.error("admin/session", touchError);

  await logAdminLogin(normalizedEmail, true);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/session — déconnexion administrateur (journalisée). */
export async function DELETE() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true });
  }
  const ctx = await getAdminContext();
  const supabase = await createClient();
  await supabase.auth.signOut();
  if (ctx) {
    await logAdminAction(ctx, { action: "admin.logout" });
  }
  return NextResponse.json({ ok: true });
}
