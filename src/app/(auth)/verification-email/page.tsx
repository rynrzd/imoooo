"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormField } from "@/components/shared/form-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";

/** Délai minimal entre deux renvois (anti-abus côté interface ; Supabase
 * applique en plus sa propre limite d'envoi côté serveur). */
const COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  // Adresse pré-remplie : ?email=… (connexion), sinon session non confirmée.
  const [email, setEmail] = React.useState(() => searchParams.get("email") ?? "");
  const [pending, setPending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

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
    const id = window.setInterval(
      () => setCooldown((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearInterval(id);
  }, [cooldown]);

  const resend = async () => {
    if (pending || cooldown > 0) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast.error("Saisissez une adresse e-mail valide.");
      return;
    }
    setPending(true);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error, "resend"));
      return;
    }
    setCooldown(COOLDOWN_SECONDS);
    // Message neutre : ne révèle pas si l'adresse possède un compte.
    toast.success(
      "Si un compte non confirmé existe avec cette adresse, un nouveau lien vient d'être envoyé."
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
          <MailCheck className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          Votre compte doit être activé via le lien reçu par e-mail avant de
          pouvoir accéder à l&apos;application. Pensez à vérifier le dossier
          spam.
        </p>
      </div>
      <FormField label="Adresse e-mail" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FormField>
      <Button
        className="w-full"
        onClick={() => void resend()}
        disabled={!isSupabaseConfigured || pending || cooldown > 0}
      >
        {pending
          ? "Envoi…"
          : cooldown > 0
            ? `Renvoyer l'e-mail (${cooldown} s)`
            : "Renvoyer l'e-mail de confirmation"}
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Vérifiez votre e-mail"
      description="Un lien de confirmation vous a été envoyé lors de l'inscription."
      footer={
        <p>
          Déjà confirmé ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      <React.Suspense>
        <VerifyEmailForm />
      </React.Suspense>
    </AuthShell>
  );
}
