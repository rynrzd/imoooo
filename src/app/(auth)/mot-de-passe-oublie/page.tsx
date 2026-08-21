"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailField, FormError } from "@/components/auth/auth-fields";
import { captchaOptions, useCaptcha } from "@/components/auth/captcha";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";

/**
 * Mot de passe oublié — même composition que les autres écrans.
 *
 * Deux corrections de fond au passage :
 * - le message d'erreur brut de Supabase n'est plus affiché (« Envoi
 *   impossible : … » exposait le texte anglais de GoTrue) ;
 * - la réussite est formulée de façon NEUTRE : elle ne permet pas de savoir si
 *   une adresse possède un compte.
 *
 * Le lien pointe toujours vers `/auth/callback?next=/reinitialiser-mot-de-passe` :
 * la route et le flux de récupération sont inchangés.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  // Neutre tant que NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas renseignée.
  const captcha = useCaptcha();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const address = email.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
    setEmailError(valid ? null : "Saisissez une adresse e-mail valide.");
    setFormError(null);
    if (!valid) return;

    setPending(true);
    try {
      // Le jeton anti-robot est attendu ICI, et non lu depuis un état : sans
      // cette attente, une soumission plus rapide que Cloudflare partait sans
      // `captchaToken` et GoTrue la refusait (captcha_failed).
      const captchaToken = await captcha.getToken();
      const { error } = await createClient().auth.resetPasswordForEmail(address, {
        redirectTo: `${SITE_URL}/auth/callback?next=/reinitialiser-mot-de-passe`,
        ...captchaOptions(captchaToken),
      });
      if (error) {
        // Jeton à usage unique : il faut un nouveau défi pour réessayer.
        captcha.reset();
        setFormError(authErrorMessage(error, "reset"));
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        label="Accès"
        title="Consultez votre boîte mail."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/connexion"
              className="inline-block py-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              Retour à la connexion
            </Link>
          </p>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-600/10 text-emerald-700">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-foreground">
            Si un compte correspond à cette adresse, vous recevrez un lien de
            réinitialisation.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      label="Accès"
      title="Réinitialisez votre mot de passe."
      description="Entrez votre adresse e-mail pour recevoir un lien sécurisé."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/connexion"
            className="inline-block py-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            Retour à la connexion
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

        {captcha.widget}

        <Button
          type="submit"
          className="w-full"
          disabled={!isSupabaseConfigured || pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Envoi…
            </>
          ) : (
            "Recevoir le lien"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
