"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const schema = z.object({
  email: z.string().email("E-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

type FormValues = z.infer<typeof schema>;

/**
 * Formulaire de connexion administrateur. Le mot de passe est vérifié
 * PAR LE SERVEUR (/api/admin/session) : rate-limit, contrôle du rôle en
 * base et journal d'audit — rien de tout cela ne vit dans le navigateur.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return;
    setPending(true);
    setServerError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Le serveur a déjà détruit la session en cas de refus : on ne fait
        // qu'afficher son verdict (jamais de contrôle d'accès côté client).
        const message = payload.error ?? "Connexion impossible. Réessayez.";
        setServerError(message);
        toast.error(message);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setServerError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setPending(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Adresse e-mail" htmlFor="admin-email" error={errors.email?.message}>
        <Input
          id="admin-email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          {...register("email")}
        />
      </FormField>
      <FormField
        label="Mot de passe"
        htmlFor="admin-password"
        error={errors.password?.message}
      >
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
      </FormField>
      {serverError ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {serverError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={!isSupabaseConfigured || pending}>
        {pending ? "Vérification…" : "Se connecter"}
      </Button>
    </form>
  );
}
