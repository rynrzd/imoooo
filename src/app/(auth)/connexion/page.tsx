"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormField } from "@/components/shared/form-field";
import { createClient, setRememberSession } from "@/lib/supabase/client";
import {
  authErrorMessage,
  isEmailNotConfirmed,
} from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const schema = z.object({
  email: z.string().email("E-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

type FormValues = z.infer<typeof schema>;

/** Messages liés au callback e-mail (?erreur=…), en français clair. */
const CALLBACK_MESSAGES: Record<string, string> = {
  "lien-expire": "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  "lien-invalide": "Ce lien est invalide ou a expiré. Veuillez réessayer.",
  "lien-invalide-ou-expire": "Ce lien est invalide ou a expiré. Veuillez réessayer.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);
  // Case cochée par défaut : session persistante sur cet appareil.
  const [remember, setRemember] = React.useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    const erreur = searchParams.get("erreur");
    if (erreur && CALLBACK_MESSAGES[erreur]) {
      toast.error(CALLBACK_MESSAGES[erreur]);
    }
  }, [searchParams]);

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return; // double clic
    setPending(true);
    // Préférence de persistance posée AVANT la connexion : la session est
    // écrite d'emblée avec la bonne durée (persistante ou éphémère).
    setRememberSession(remember);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    setPending(false);
    if (error) {
      // Compte non confirmé : direction la page de vérification (renvoi du lien).
      if (isEmailNotConfirmed(error)) {
        toast.error("Votre adresse e-mail n'est pas encore confirmée.");
        router.push(
          `/verification-email?email=${encodeURIComponent(values.email)}`
        );
        return;
      }
      toast.error(authErrorMessage(error, "signin"));
      return;
    }
    // Sécurité : uniquement des chemins internes (jamais //hote-externe).
    const next = searchParams.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(safeNext);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Adresse e-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          {...register("email")}
        />
      </FormField>
      <FormField label="Mot de passe" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          Garder ma session ouverte sur cet appareil
        </label>
        <Link
          href="/mot-de-passe-oublie"
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={!isSupabaseConfigured || pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      description="Accédez à votre espace de gestion locative."
      footer={
        <p>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-foreground underline-offset-2 hover:underline">
            Créer un compte
          </Link>
          <span className="mx-2 text-muted-foreground/50">·</span>
          <Link
            href="/admin/login"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Administrateur
          </Link>
        </p>
      }
    >
      <React.Suspense>
        <LoginForm />
      </React.Suspense>
    </AuthShell>
  );
}
