"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailField, FormError, PasswordField } from "@/components/auth/auth-fields";
import { captchaOptions, useCaptcha } from "@/components/auth/captcha";
import { Button } from "@/components/ui/button";
import { createClient, setRememberSession } from "@/lib/supabase/client";
import { authErrorMessage, isEmailNotConfirmed } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Connexion — même photographie, même placement de marque que l'inscription.
 *
 * Rien de la logique n'a bougé : `signInWithPassword`, la redirection vers
 * `?next=` (chemins internes uniquement), le renvoi vers l'écran de
 * vérification quand l'adresse n'est pas confirmée.
 *
 * « Rester connecté » est conservé parce qu'il a un effet RÉEL : décoché, le
 * cookie de session Supabase perd son `maxAge` et meurt à la fermeture du
 * navigateur (cf. lib/supabase/session-persistence).
 *
 * Le lien « Administrateur » a disparu : l'administration garde sa route
 * dédiée et n'a jamais à être proposée à un visiteur.
 */

/** Messages liés au retour du lien e-mail (?erreur=…), en français clair. */
const CALLBACK_MESSAGES: Record<string, string> = {
  "lien-expire": "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  "lien-invalide": "Ce lien est invalide ou a expiré. Veuillez réessayer.",
  "lien-invalide-ou-expire": "Ce lien est invalide ou a expiré. Veuillez réessayer.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  // Retour d'un lien e-mail expiré : le message est posé dès le premier rendu,
  // dans le formulaire — pas dans une notification qui s'efface avant d'être
  // lue, et sans effet qui déclencherait un second rendu.
  const [formError, setFormError] = React.useState<string | null>(
    () => CALLBACK_MESSAGES[searchParams.get("erreur") ?? ""] ?? null
  );
  const [pending, setPending] = React.useState(false);
  // Coché par défaut : la session survit à la fermeture du navigateur.
  const [remember, setRemember] = React.useState(true);
  // Sans clé Turnstile configurée, `captcha` est entièrement neutre : pas de
  // widget, pas de jeton, aucune option ajoutée à l'appel Supabase.
  const captcha = useCaptcha();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const address = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
    setEmailError(validEmail ? null : "Saisissez une adresse e-mail valide.");
    setPasswordError(password ? null : "Saisissez votre mot de passe.");
    setFormError(null);
    if (!validEmail || !password) return;

    setPending(true);
    try {
      // Préférence de persistance posée AVANT la connexion : la session est
      // écrite d'emblée avec la bonne durée.
      setRememberSession(remember);
      // Le jeton anti-robot est attendu ICI, et non lu depuis un état : sans
      // cette attente, une soumission plus rapide que Cloudflare partait sans
      // `captchaToken` et GoTrue la refusait (captcha_failed).
      const captchaToken = await captcha.getToken();
      const { error } = await createClient().auth.signInWithPassword({
        email: address,
        password,
        options: captchaOptions(captchaToken),
      });

      if (error) {
        // Le jeton Turnstile est à usage unique : sans cette remise à zéro,
        // une seconde tentative après un mot de passe erroné échouerait pour
        // « jeton déjà consommé », message que personne ne peut relier à sa
        // vraie cause.
        captcha.reset();
        if (isEmailNotConfirmed(error)) {
          router.push(`/verification-email?email=${encodeURIComponent(address)}`);
          return;
        }
        setFormError(authErrorMessage(error, "signin"));
        return;
      }

      const next = searchParams.get("next");
      // Chemin interne uniquement — la contre-barre est refusée comme « // » :
      // un analyseur d'URL la relit en barre oblique (« /\evil.com » →
      // « //evil.com », adresse protocol-relative vers un autre domaine).
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
          ? next
          : "/";
      router.replace(safeNext);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      label="Bon retour"
      title="Retrouvez votre espace."
      description="Vos logements, vos documents et vos chiffres vous attendent."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
          >
            Ouvrir mon espace gratuit
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />

        <EmailField
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError ?? undefined}
          autoFocus
        />

        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={passwordError ?? undefined}
          trailing={
            <Link
              href="/mot-de-passe-oublie"
              className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          }
        />

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 shrink-0 rounded border-input bg-transparent text-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
          Rester connecté sur cet appareil
        </label>

        {captcha.widget}

        <Button
          type="submit"
          className="w-full"
          disabled={!isSupabaseConfigured || pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          Connexion sécurisée
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
