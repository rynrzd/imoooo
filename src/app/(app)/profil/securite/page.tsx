"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/form/fields";
import { toUserMessage } from "@/components/form/errors";
import { SubmitButton } from "@/components/form/submit-button";
import {
  SettingsPageShell,
  SettingsSection,
} from "@/components/profile/settings-shell";
import { updatePassword, verifyCurrentPassword } from "@/lib/supabase/account";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Sécurité — mot de passe et sessions.
 *
 * LA règle réellement appliquée est unique : huit caractères minimum. C'est
 * elle qui est affichée, cochée en direct. L'indicateur de robustesse, lui, est
 * annoncé pour ce qu'il est : un conseil, pas une condition — promettre une
 * exigence que le serveur n'applique pas serait un mensonge d'interface.
 */

const MIN_LENGTH = 8;

/** Robustesse INDICATIVE : longueur et variété de caractères. */
function strengthOf(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  return {
    score,
    label: score >= 80 ? "Fort" : score >= 50 ? "Correct" : "Faible",
  };
}

/** Champ mot de passe avec bascule afficher / masquer. */
function PasswordField({
  id,
  label,
  hint,
  error,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  autoComplete: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className="w-full border border-input bg-card pr-12 text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-danger/20"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </Field>
  );
}

export default function SecurityPage() {
  const { profile } = useAppStore();
  const router = useRouter();
  const [lastSignIn, setLastSignIn] = React.useState<string | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    // La valeur arrive dans un callback asynchrone : aucun setState synchrone
    // dans le corps de l'effet.
    void createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        setLastSignIn(session?.user.last_sign_in_at ?? null);
      });
  }, []);

  const [current, setCurrent] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const strength = strengthOf(password);
  const longEnough = password.length >= MIN_LENGTH;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const next: Record<string, string> = {};
    if (current.length === 0) {
      next.current = "Votre mot de passe actuel est requis.";
    }
    if (!longEnough) {
      next.password = `Choisissez au moins ${MIN_LENGTH} caractères.`;
    }
    if (password !== confirm) {
      next.confirm = "Les deux mots de passe ne correspondent pas.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (!isSupabaseConfigured) {
      toast.info("Mode démo : configurez Supabase pour activer les comptes.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (!profile?.email) throw new Error("Session expirée. Reconnectez-vous.");
      const valid = await verifyCurrentPassword(
        supabase,
        profile.email,
        current
      );
      if (!valid) {
        setErrors({ current: "Mot de passe actuel incorrect." });
        return;
      }
      await updatePassword(supabase, password);
      setCurrent("");
      setPassword("");
      setConfirm("");
      toast.success(
        "Mot de passe modifié. Vos autres appareils restent connectés — utilisez « Se déconnecter partout » pour les révoquer."
      );
    } catch (e) {
      toast.error(toUserMessage(e, "Modification impossible."));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async (scope: "local" | "global") => {
    if (!isSupabaseConfigured) {
      toast.info("Mode démo : configurez Supabase pour activer les comptes.");
      return;
    }
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await createClient().auth.signOut({ scope });
    if (error) {
      toast.error(toUserMessage(error, "Déconnexion impossible."));
      setSigningOut(false);
      return;
    }
    router.replace("/connexion");
    router.refresh();
  };

  return (
    <SettingsPageShell
      title="Sécurité"
      description="Votre mot de passe et les appareils connectés à votre compte."
    >
      <SettingsSection title="Mot de passe">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <PasswordField
            id="current-password"
            label="Mot de passe actuel"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            error={errors.current}
          />

          <div className="space-y-3">
            <PasswordField
              id="new-password"
              label="Nouveau mot de passe"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              error={errors.password}
            />

            {/* La SEULE règle réellement appliquée, cochée en direct. */}
            <p
              className={cn(
                "flex items-center gap-2 text-xs",
                longEnough ? "text-success" : "text-muted-foreground"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-4 place-items-center rounded-full border",
                  longEnough
                    ? "border-success bg-success text-white"
                    : "border-border"
                )}
              >
                {longEnough ? <Check className="size-2.5" /> : null}
              </span>
              {MIN_LENGTH} caractères minimum
            </p>

            {password.length > 0 ? (
              <div className="space-y-1">
                <div
                  className="h-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={strength.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Robustesse du mot de passe"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-200",
                      strength.score >= 80
                        ? "bg-success"
                        : strength.score >= 50
                          ? "bg-warning"
                          : "bg-danger"
                    )}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Robustesse indicative : {strength.label}. Majuscules, chiffres
                  et symboles la renforcent, sans être obligatoires.
                </p>
              </div>
            ) : null}
          </div>

          <PasswordField
            id="confirm-password"
            label="Confirmer le nouveau mot de passe"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
          />

          <SubmitButton pending={busy} pendingLabel="Modification…">
            Mettre à jour le mot de passe
          </SubmitButton>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Sessions et appareils"
        description="Supabase ne fournit pas la liste détaillée des appareils : seules la session actuelle et la déconnexion globale sont disponibles."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Cet appareil</p>
              <p className="text-xs text-muted-foreground">
                {lastSignIn
                  ? `Dernière connexion : ${new Date(lastSignIn).toLocaleString("fr-FR")}`
                  : "Session active"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
              Session actuelle
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut("local")}
              className="inline-flex min-h-11 items-center gap-2 rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden />
              Se déconnecter de cet appareil
            </button>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut("global")}
              className="min-h-11 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
            >
              Se déconnecter partout
            </button>
          </div>
        </div>
      </SettingsSection>
    </SettingsPageShell>
  );
}
