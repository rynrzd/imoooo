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
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";

const schema = z.object({
  email: z.string().email("E-mail invalide."),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setPending(true);
    const supabase = createClient();
    // NEXT_PUBLIC_SITE_URL : lien de réinitialisation vers l'URL canonique.
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${SITE_URL}/auth/callback?next=/reinitialiser-mot-de-passe`,
    });
    setPending(false);
    if (error) {
      toast.error("Envoi impossible : " + error.message);
      return;
    }
    setSent(true);
  });

  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Recevez un lien de réinitialisation par e-mail."
      footer={
        <Link href="/connexion" className="underline-offset-2 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm text-foreground">
            Si un compte existe avec cette adresse, un e-mail de
            réinitialisation vient d&apos;être envoyé.
          </p>
        </div>
      ) : (
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
          <Button type="submit" className="w-full" disabled={!isSupabaseConfigured || pending}>
            {pending ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
