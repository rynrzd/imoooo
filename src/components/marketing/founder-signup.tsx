"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Crown, Loader2, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import {
  FOUNDER_SCOPE_NOTICE,
  FOUNDER_TIERS,
  FOUNDER_TOTAL_PLACES,
} from "@/config/plans";
import { setFounderIntent } from "@/lib/founder-intent";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
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

/** Ce que le compte Fondateur débloque — engagements réels uniquement. */
const PITCH = [
  "Accès Business+ à vie — un seul paiement, aucun abonnement",
  `Place Fondateur numérotée, limitée à ${FOUNDER_TOTAL_PLACES} comptes`,
  "299 € pour les 50 premières places, 499 € pour les 50 suivantes",
  "Accès immédiat dès la confirmation du paiement",
];

type Stage =
  | "checking" // session en cours de vérification
  | "signup" // visiteur : formulaire de création de compte
  | "sent" // e-mail de confirmation envoyé
  | "redirecting" // connecté : création du Checkout en cours
  | "already-founder"
  | "sold-out"
  | "checkout-error";

export function FounderSignup({ stripeEnabled }: { stripeEnabled: boolean }) {
  // Sans Supabase (mode démo) : directement le formulaire, jamais de spinner.
  const [stage, setStage] = React.useState<Stage>(() =>
    isSupabaseConfigured ? "checking" : "signup"
  );
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const startedRef = React.useRef(false);

  const startCheckout = React.useCallback(async () => {
    setStage("redirecting");
    try {
      const response = await fetch("/api/stripe/founder-checkout", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (response.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      if (response.status === 401) {
        setStage("signup");
        return;
      }
      if (response.status === 409) {
        setStage("already-founder");
        return;
      }
      if (response.status === 410) {
        setStage("sold-out");
        return;
      }
      toast.error(body.error ?? "Paiement indisponible pour le moment.");
      setStage("checkout-error");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
      setStage("checkout-error");
    }
  }, []);

  // Connecté → Checkout immédiat ; visiteur → création de compte.
  React.useEffect(() => {
    if (startedRef.current || !isSupabaseConfigured) return;
    startedRef.current = true;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user && !user.is_anonymous) void startCheckout();
        else setStage("signup");
      })
      .catch(() => setStage("signup"));
  }, [startCheckout]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return; // double clic / double soumission
    setPending(true);
    // L'intention est posée AVANT l'inscription : après confirmation de
    // l'e-mail, l'application reprend automatiquement le tunnel de paiement.
    setFounderIntent();
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
      // Confirmation désactivée côté Supabase : session immédiate → paiement.
      void startCheckout();
      return;
    }
    setSentTo(values.email);
    setStage("sent");
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        {/* Pitch — quelques lignes, pas un argumentaire. */}
        <div className="space-y-6">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            <Crown className="size-4" aria-hidden />
            Offre Fondateur — édition limitée
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Créer mon compte Fondateur
          </h1>
          <ul className="space-y-3">
            {PITCH.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-foreground sm:text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {line}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {FOUNDER_TIERS.map((tier) => (
              <div key={tier.tier} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {tier.price} €{" "}
                  <span className="text-xs font-normal text-muted-foreground">à vie</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  places {tier.fromPlace} à {tier.toPlace}
                </p>
              </div>
            ))}
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {FOUNDER_SCOPE_NOTICE}
          </p>
        </div>

        {/* Colonne action : dépend de l'état de session. */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {stage === "checking" || stage === "redirecting" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-foreground">
                {stage === "redirecting"
                  ? "Redirection vers le paiement sécurisé Stripe…"
                  : "Vérification de votre compte…"}
              </p>
            </div>
          ) : stage === "sent" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                <MailCheck className="size-5" />
              </span>
              <p className="text-sm text-foreground">
                Si l&apos;adresse <span className="font-medium">{sentTo}</span> peut être
                utilisée, vous allez recevoir un e-mail de confirmation.
              </p>
              <p className="text-xs text-muted-foreground">
                Cliquez sur le lien reçu : le paiement Fondateur démarrera
                automatiquement à votre première connexion.
              </p>
            </div>
          ) : stage === "already-founder" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                <Crown className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Vous êtes déjà Fondateur.</p>
              <p className="text-xs text-muted-foreground">
                Votre accès Business+ à vie est actif — il n&apos;y a rien à acheter.
              </p>
              <Button size="sm" render={<Link href="/abonnement" />}>
                Voir mon abonnement
              </Button>
            </div>
          ) : stage === "sold-out" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-medium text-foreground">
                L&apos;offre Fondateur est épuisée.
              </p>
              <p className="text-xs text-muted-foreground">
                Les {FOUNDER_TOTAL_PLACES} places ont été attribuées. Les plans
                mensuels restent disponibles.
              </p>
              <Button size="sm" variant="outline" render={<Link href="/tarifs" />}>
                Voir les plans
              </Button>
            </div>
          ) : stage === "checkout-error" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-foreground">
                Le paiement n&apos;a pas pu démarrer.
              </p>
              <Button size="sm" onClick={() => void startCheckout()}>
                Réessayer
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField label="Nom complet" htmlFor="founder-fullName" error={errors.fullName?.message}>
                <Input id="founder-fullName" autoComplete="name" placeholder="Camille Roux" {...register("fullName")} />
              </FormField>
              <FormField label="Adresse e-mail" htmlFor="founder-email" error={errors.email?.message}>
                <Input id="founder-email" type="email" autoComplete="email" placeholder="vous@exemple.fr" {...register("email")} />
              </FormField>
              <FormField label="Mot de passe" htmlFor="founder-password" error={errors.password?.message}>
                <Input id="founder-password" type="password" autoComplete="new-password" {...register("password")} />
              </FormField>
              <FormField label="Confirmer le mot de passe" htmlFor="founder-confirm" error={errors.confirm?.message}>
                <Input id="founder-confirm" type="password" autoComplete="new-password" {...register("confirm")} />
              </FormField>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!isSupabaseConfigured || !stripeEnabled || pending}
              >
                <Crown data-icon="inline-start" />
                {pending ? "Création…" : "Créer mon compte Fondateur"}
              </Button>
              {!stripeEnabled ? (
                <p className="text-center text-xs text-muted-foreground">
                  Paiement en ligne bientôt disponible — aucune place ne peut être
                  réservée pour l&apos;instant.
                </p>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Après confirmation de votre e-mail, le paiement sécurisé Stripe
                  démarre automatiquement — vous n&apos;aurez pas à rechercher l&apos;offre.
                </p>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Déjà inscrit ?{" "}
                <Link href="/connexion?next=/fondateur" className="font-medium text-foreground underline-offset-2 hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
