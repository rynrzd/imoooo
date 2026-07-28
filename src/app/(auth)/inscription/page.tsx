"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, Loader2, Lock, MailCheck, ShieldCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    fullName: z.string().min(2, "Nom requis."),
    email: z.string().email("E-mail invalide."),
    password: z.string().min(8, "8 caractères minimum."),
    confirm: z.string(),
    terms: z.boolean().refine((v) => v === true, "Vous devez accepter les conditions."),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

type FormValues = z.infer<typeof schema>;

/* Force du mot de passe : longueur + variété de caractères (0 → 4). */
function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const SCORE_LABEL = ["", "Très faible", "Faible", "Correct", "Excellent"];
const SCORE_COLOR = ["bg-muted", "bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-primary"];

function PasswordStrength({ value }: { value: string }) {
  const score = passwordScore(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= score ? SCORE_COLOR[score] : "bg-muted")} />
        ))}
      </div>
      {value ? <p className="mt-1.5 text-[11px] text-muted-foreground">Sécurité : <span className="text-foreground">{SCORE_LABEL[score]}</span></p> : null}
    </div>
  );
}

const TRUST = [
  { icon: ShieldCheck, label: "Données protégées" },
  { icon: Check, label: "Sans engagement" },
  { icon: Lock, label: "Gratuit disponible" },
];

export default function SignupPage() {
  const [pending, setPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [showPw, setShowPw] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { fullName: "", email: "", password: "", confirm: "", terms: false },
  });

  const password = useWatch({ control, name: "password" }) ?? "";
  const confirm = useWatch({ control, name: "confirm" }) ?? "";
  const matches = Boolean(password) && password === confirm;

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return;
    setPending(true);
    const supabase = createClient();
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
    if (data.session) {
      window.location.assign("/");
      return;
    }
    setSentTo(values.email);
  });

  return (
    <AuthShell
      title="Créer votre espace"
      description="Le centre de contrôle de votre patrimoine, prêt en quelques minutes."
      footer={
        <p>
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-medium text-foreground underline-offset-2 hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      {sentTo ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm text-foreground">
            Si l’adresse <span className="font-medium">{sentTo}</span> peut être utilisée, vous allez recevoir un e-mail de confirmation.
          </p>
          <p className="text-xs text-muted-foreground">
            Cliquez sur le lien reçu pour activer votre compte. Rien après quelques minutes ? Cette adresse a peut-être déjà un compte.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" render={<Link href="/connexion" />}>Se connecter</Button>
            <Button variant="ghost" size="sm" render={<Link href="/mot-de-passe-oublie" />}>Mot de passe oublié</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" autoComplete="name" placeholder="Camille Roux" aria-invalid={!!errors.fullName} {...register("fullName")} />
            {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="vous@exemple.fr" aria-invalid={!!errors.email} {...register("email")} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input id="password" type={showPw ? "text" : "password"} autoComplete="new-password" className="pr-10" aria-invalid={!!errors.password} {...register("password")} />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <PasswordStrength value={password} />
            {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <div className="relative">
              <Input id="confirm" type={showPw ? "text" : "password"} autoComplete="new-password" className="pr-10" aria-invalid={!!errors.confirm} {...register("confirm")} />
              {matches ? (
                <span className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-primary" aria-hidden>
                  <Check className="size-4" />
                </span>
              ) : null}
            </div>
            {errors.confirm ? <p className="text-xs text-destructive">{errors.confirm.message}</p> : null}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input bg-transparent text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
              {...register("terms")}
            />
            <span>
              J’accepte les{" "}
              <Link href="/cgu" target="_blank" className="text-foreground underline-offset-2 hover:underline">conditions d’utilisation</Link>{" "}
              et la{" "}
              <Link href="/confidentialite" target="_blank" className="text-foreground underline-offset-2 hover:underline">politique de confidentialité</Link>.
            </span>
          </label>
          {errors.terms ? <p className="-mt-2 text-xs text-destructive">{errors.terms.message}</p> : null}

          <Button type="submit" className="nireo-sheen w-full" disabled={!isSupabaseConfigured || pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Création…
              </>
            ) : (
              "Créer mon compte gratuitement"
            )}
          </Button>

          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-1">
            {TRUST.map((t) => (
              <li key={t.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <t.icon className="size-3.5 text-primary/80" /> {t.label}
              </li>
            ))}
          </ul>
        </form>
      )}
    </AuthShell>
  );
}
