"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { isSupabaseConfigured } from "@/lib/supabase/config";

const schema = z
  .object({
    password: z.string().min(8, "8 caractères minimum."),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  // null = vérification en cours ; false = pas de session (lien mort).
  const [hasSession, setHasSession] = React.useState<boolean | null>(
    isSupabaseConfigured ? null : false
  );

  // Le formulaire n'a de sens qu'avec la session créée par le lien de
  // récupération : sans elle, message clair au lieu d'un échec à la soumission.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setHasSession(Boolean(user)));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return; // double clic
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error, "update"));
      return;
    }
    toast.success("Mot de passe mis à jour.");
    router.replace("/");
    router.refresh();
  });

  if (hasSession === false) {
    return (
      <AuthShell
        title="Nouveau mot de passe"
        description="Choisissez un nouveau mot de passe pour votre compte."
        footer={
          <Link href="/connexion" className="underline-offset-2 hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm text-foreground">
            Ce lien est invalide ou a expiré.
          </p>
          <p className="text-xs text-muted-foreground">
            Demandez un nouveau lien de réinitialisation, puis ouvrez-le depuis
            le même appareil.
          </p>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/mot-de-passe-oublie" />}
          >
            Recevoir un nouveau lien
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      description="Choisissez un nouveau mot de passe pour votre compte."
      footer={
        <Link href="/connexion" className="underline-offset-2 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Nouveau mot de passe" htmlFor="password" error={errors.password?.message}>
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
          {pending ? "Mise à jour…" : "Mettre à jour"}
        </Button>
      </form>
    </AuthShell>
  );
}
