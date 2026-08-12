"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Briques communes aux quatre écrans d'authentification.
 *
 * Elles existent pour une raison précise : l'erreur et le champ doivent se
 * comporter EXACTEMENT pareil partout — annoncée aux lecteurs d'écran,
 * rattachée au champ par `aria-describedby`, jamais un simple toast qui
 * disparaît avant d'être lu.
 */

/* ------------------------------------------------------------------ */
/*  Message d'erreur du formulaire                                    */
/* ------------------------------------------------------------------ */

export function FormError({
  message,
  /** Lien d'action proposé avec le message (ex. « Se connecter »). */
  action,
}: {
  message: string | null;
  action?: { href: string; label: string };
}) {
  // `role="alert"` : la technologie d'assistance annonce le message dès qu'il
  // apparaît, sans déplacer le focus de l'utilisateur.
  return (
    <div aria-live="polite">
      {message ? (
        <p
          role="alert"
          className="animate-panel-in flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {message}
            {action ? (
              <>
                {" "}
                <Link
                  href={action.href}
                  className="font-medium text-destructive underline underline-offset-2"
                >
                  {action.label}
                </Link>
              </>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Champ e-mail                                                      */
/* ------------------------------------------------------------------ */

export const EmailField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { error?: string }
>(function EmailField({ error, id = "email", ...props }, ref) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Adresse e-mail</Label>
      <Input
        ref={ref}
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="vous@exemple.fr"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Champ mot de passe (affichage / masquage réel)                    */
/* ------------------------------------------------------------------ */

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & {
    label?: string;
    error?: string;
    /** Aide affichée sous le champ tant qu'il n'y a pas d'erreur. */
    hint?: string;
    /** Lien aligné à droite sous le champ (mot de passe oublié). */
    trailing?: React.ReactNode;
  }
>(function PasswordField(
  { label = "Mot de passe", error, hint, trailing, id = "password", className, ...props },
  ref
) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          className={cn("pr-12", className)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />
        {/* 44 px de côté : la cible reste confortable au pouce. */}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {trailing ? <div className="flex justify-end pt-0.5">{trailing}</div> : null}
    </div>
  );
});
