"use client";

import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormField } from "@/components/shared/form-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";

const schema = z
  .object({
    fullName: z.string().min(2, "Nom requis."),
    email: z.string().email("E-mail invalide."),
    password: z.string().min(8, "8 caractères minimum."),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [pending, setPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return; // double clic
    setPending(true);
    const supabase = createClient();
    // NEXT_PUBLIC_SITE_URL : le lien de confirmation pointe toujours vers
    // l'URL canonique du site (localhost en dev, domaine en production).
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error, "signup"));
      return;
    }
    // Adresse déjà enregistrée : Supabase renvoie un utilisateur factice sans
    // identité et N'ENVOIE PAS d'e-mail. Aucun compte n'est créé — l'écran
    // reste neutre (pas d'énumération) et n'annonce jamais un nouveau compte.
    // Confirmation obligatoire : pas de session ici, jamais d'accès direct.
    if (data.session) {
      window.location.assign("/");
      return;
    }
    setSentTo(values.email);
  });

  return (
    <AuthShell
      title="Créer un compte"
      description="Commencez à piloter votre patrimoine en quelques minutes."
      footer={
        <p>
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-medium text-foreground underline-offset-2 hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      {sentTo ? (
        // Message volontairement neutre : identique que l'adresse soit nouvelle
        // ou déjà enregistrée (aucune énumération de comptes, aucune fausse
        // promesse de création).
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm text-foreground">
            Si l&apos;adresse <span className="font-medium">{sentTo}</span> peut
            être utilisée, vous allez recevoir un e-mail de confirmation.
          </p>
          <p className="text-xs text-muted-foreground">
            Cliquez sur le lien reçu pour activer votre compte. Rien reçu après
            quelques minutes ? Cette adresse a peut-être déjà un compte.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" render={<Link href="/connexion" />}>
              Se connecter
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/mot-de-passe-oublie" />}>
              Mot de passe oublié
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Nom complet" htmlFor="fullName" error={errors.fullName?.message}>
            <Input id="fullName" autoComplete="name" placeholder="Camille Roux" {...register("fullName")} />
          </FormField>
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
              autoComplete="new-password"
              {...register("password")}
            />
          </FormField>
          <FormField label="Confirmer le mot de passe" htmlFor="confirm" error={errors.confirm?.message}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register("confirm")}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={!isSupabaseConfigured || pending}>
            {pending ? "Création…" : "Créer mon compte"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
