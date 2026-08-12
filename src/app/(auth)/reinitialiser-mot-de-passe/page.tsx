"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError, PasswordField } from "@/components/auth/auth-fields";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, PASSWORD_MIN_LENGTH } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Nouveau mot de passe — dernière étape du lien de récupération.
 *
 * Le formulaire n'a de sens qu'avec la session créée par le lien : sans elle,
 * on le dit clairement au lieu d'échouer à la soumission. La logique
 * (`updateUser`) et la redirection vers l'espace sont inchangées.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  // null = vérification en cours ; false = pas de session (lien mort).
  const [hasSession, setHasSession] = React.useState<boolean | null>(
    isSupabaseConfigured ? null : false
  );

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setHasSession(Boolean(user)));
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const tooShort = password.length < PASSWORD_MIN_LENGTH;
    setPasswordError(
      tooShort ? `Mot de passe trop court : ${PASSWORD_MIN_LENGTH} caractères minimum.` : null
    );
    const mismatch = password !== confirm;
    setConfirmError(mismatch ? "Les mots de passe ne correspondent pas." : null);
    setFormError(null);
    if (tooShort || mismatch) return;

    setPending(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setFormError(authErrorMessage(error, "update"));
        return;
      }
      toast.success("Mot de passe mis à jour.");
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const backToLogin = (
    <p className="text-center text-sm text-muted-foreground">
      <Link href="/connexion" className="font-medium text-primary underline-offset-4 hover:underline">
        Retour à la connexion
      </Link>
    </p>
  );

  if (hasSession === false) {
    return (
      <AuthShell
        label="Accès"
        title="Ce lien n’est plus valable."
        description="Demandez un nouveau lien, puis ouvrez-le depuis le même appareil."
        footer={backToLogin}
      >
        <Button className="h-12 w-full" render={<Link href="/mot-de-passe-oublie" />}>
          Recevoir un nouveau lien
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      label="Accès"
      title="Choisissez un nouveau mot de passe."
      description="Il remplacera immédiatement l’ancien sur tous vos appareils."
      footer={backToLogin}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />

        <PasswordField
          label="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={passwordError ?? undefined}
          hint={`${PASSWORD_MIN_LENGTH} caractères minimum.`}
          autoFocus
        />

        <PasswordField
          id="confirm"
          label="Confirmer le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={confirmError ?? undefined}
        />

        <Button type="submit" className="w-full" disabled={!isSupabaseConfigured || pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Mise à jour…
            </>
          ) : (
            "Mettre à jour"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
