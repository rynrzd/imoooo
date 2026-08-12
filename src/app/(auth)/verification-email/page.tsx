"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailField, FormError } from "@/components/auth/auth-fields";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";

/**
 * Écran de vérification — atteint par le proxy quand une session existe sans
 * adresse confirmée, ou depuis la connexion. Même composition que les autres.
 *
 * L'inscription affiche désormais son propre écran de confirmation juste après
 * l'envoi ; celui-ci reste le point de passage pour revenir plus tard.
 */

/** Délai anti-abus entre deux renvois (Supabase applique aussi le sien). */
const COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  // Adresse pré-remplie : ?email=… (connexion), sinon session non confirmée.
  const [email, setEmail] = React.useState(() => searchParams.get("email") ?? "");
  const [pending, setPending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured || searchParams.get("email")) return;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.email && !user.email_confirmed_at) setEmail(user.email);
      });
  }, [searchParams]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || cooldown > 0) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Saisissez une adresse e-mail valide.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
      });
      if (resendError) {
        setError(authErrorMessage(resendError, "resend"));
        return;
      }
      setCooldown(COOLDOWN_SECONDS);
      // Formulation neutre : ne révèle pas si l'adresse possède un compte.
      setMessage(
        "Si un compte non confirmé existe avec cette adresse, un nouveau lien vient d'être envoyé."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      label="Presque terminé"
      title="Vérifiez votre boîte mail."
      description="Votre espace s’ouvre dès que l’adresse est confirmée."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/connexion" className="font-medium text-primary underline-offset-4 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <form onSubmit={resend} className="space-y-4" noValidate>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-600/10 text-emerald-700">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-foreground">
            Ouvrez le lien reçu pour activer votre compte. Pensez à regarder
            dans les indésirables.
          </p>
        </div>

        <FormError message={error} />
        <div aria-live="polite">
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        </div>

        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} />

        <Button type="submit" className="w-full" disabled={!isSupabaseConfigured || pending || cooldown > 0}>
          {pending
            ? "Envoi…"
            : cooldown > 0
              ? `Renvoyer l'e-mail (${cooldown} s)`
              : "Renvoyer l'e-mail"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense>
      <VerifyEmailForm />
    </React.Suspense>
  );
}
