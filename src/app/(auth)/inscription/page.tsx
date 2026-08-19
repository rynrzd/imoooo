"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, Infinity as InfinityIcon, Loader2, Lock, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailField, FormError, PasswordField } from "@/components/auth/auth-fields";
import { captchaOptions, useCaptcha } from "@/components/auth/captcha";
import { trackFunnel } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";
import {
  authErrorMessage,
  isExistingAccount,
  PASSWORD_MIN_LENGTH,
} from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";

/**
 * Création de compte — deux champs, une promesse, rien d'autre.
 *
 * Ne sont demandées que les informations sans lesquelles Supabase Auth ne peut
 * pas créer le compte : une adresse et un mot de passe. Pas de nom, pas de
 * téléphone, pas de patrimoine, pas de formule, pas de carte, pas de code
 * promotionnel. Le compte démarre sur le plan Gratuit — c'est-à-dire l'absence
 * d'abonnement (`DEFAULT_PLAN_ID`), rien n'est créé ici.
 *
 * Sécurité inchangée : validation avant envoi, mot de passe de
 * `PASSWORD_MIN_LENGTH` caractères minimum, confirmation d'e-mail obligatoire,
 * et réponse identique que l'adresse existe ou non (Supabase reste muet quand
 * la confirmation est active : on n'invente pas ce qu'il refuse de dire).
 *
 * Après un envoi réussi, le formulaire cède la place à un vrai écran de
 * confirmation dans la MÊME mise en page — renvoi avec délai, correction de
 * l'adresse, retour à la connexion. Personne ne reste bloqué sur un toast.
 */

/** Délai anti-abus entre deux renvois (Supabase applique aussi le sien). */
const RESEND_COOLDOWN = 60;

const REASSURANCE = [
  { icon: CreditCard, label: "Sans carte" },
  { icon: InfinityIcon, label: "Sans limite de durée" },
  { icon: Lock, label: "Données privées" },
];

/** Destination après inscription : uniquement un chemin interne. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [existing, setExisting] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  // Neutre tant que NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas renseignée.
  const captcha = useCaptcha();

  // Tunnel de conversion : « inscription démarrée » (anonyme, dédoublonné).
  React.useEffect(() => {
    trackFunnel("signup_started");
  }, []);

  const redirectTo = `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return; // double clic / double soumission clavier

    const address = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
    setEmailError(validEmail ? null : "Saisissez une adresse e-mail valide.");
    setPasswordError(
      password.length >= PASSWORD_MIN_LENGTH
        ? null
        : `Mot de passe trop court : ${PASSWORD_MIN_LENGTH} caractères minimum.`
    );
    setFormError(null);
    setExisting(false);
    if (!validEmail || password.length < PASSWORD_MIN_LENGTH) return;

    setPending(true);
    try {
      // Le jeton anti-robot est attendu ICI, et non lu depuis un état : sans
      // cette attente, une soumission plus rapide que Cloudflare partait sans
      // `captchaToken` et GoTrue la refusait (captcha_failed).
      const captchaToken = await captcha.getToken();
      const { data, error } = await createClient().auth.signUp({
        email: address,
        password,
        // `next` permet à un autre produit Nireo de ramener l'utilisateur à son
        // parcours après confirmation. Sans destination particulière, le compte
        // confirmé arrive dans son espace, où le guide prend le relais.
        options: { emailRedirectTo: redirectTo, ...captchaOptions(captchaToken) },
      });

      if (error) {
        // Jeton à usage unique : il faut un nouveau défi pour réessayer.
        captcha.reset();
        if (isExistingAccount(error)) {
          setExisting(true);
          setFormError("Un compte existe déjà avec cette adresse.");
        } else {
          setFormError(authErrorMessage(error, "signup"));
        }
        return;
      }

      if (data.session) {
        // Confirmation désactivée : la session est immédiate.
        window.location.assign(next);
        return;
      }
      setSentTo(address);
    } finally {
      setPending(false);
    }
  };

  if (sentTo) {
    return (
      <ConfirmEmail
        email={sentTo}
        redirectTo={redirectTo}
        onChangeEmail={() => {
          setSentTo(null);
          setPassword("");
        }}
      />
    );
  }

  return (
    <AuthShell
      label="Commencer"
      title="Votre premier logement est gratuit."
      description="Deux informations, et votre espace est prêt."
      footer={
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link
              href={next === "/" ? "/connexion" : `/connexion?next=${encodeURIComponent(next)}`}
              className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            En continuant, vous acceptez les{" "}
            <Link href="/cgu" target="_blank" className="inline-block py-1.5 text-primary underline-offset-2 hover:underline">
              CGU
            </Link>{" "}
            et la{" "}
            <Link
              href="/confidentialite"
              target="_blank"
              className="inline-block py-1.5 text-primary underline-offset-2 hover:underline"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError
          message={formError}
          action={existing ? { href: "/connexion", label: "Se connecter" } : undefined}
        />

        <EmailField
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError ?? undefined}
          autoFocus
        />

        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={passwordError ?? undefined}
          hint={`${PASSWORD_MIN_LENGTH} caractères minimum.`}
        />

        {captcha.widget}

        <Button
          type="submit"
          className="w-full"
          disabled={!isSupabaseConfigured || pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Création de votre espace…
            </>
          ) : (
            "Ouvrir mon espace Nireo"
          )}
        </Button>

        {/* Trois faits vérifiables, sur une ligne, séparés par un filet.
            `flex-wrap` est le garde-fou : à 320 px la ligne se coupe plutôt
            que de déborder. Aucun avis, aucun compteur, aucun label inventé. */}
        <ul className="flex flex-wrap items-center justify-center gap-y-2 pt-1 text-[0.7rem] text-muted-foreground">
          {REASSURANCE.map((item, index) => (
            <li key={item.label} className="flex items-center">
              {index > 0 ? (
                <span aria-hidden className="mx-2.5 h-3 w-px bg-border" />
              ) : null}
              <span className="flex items-center gap-1.5">
                <item.icon className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirmation de l'adresse — un vrai écran, pas une notification    */
/* ------------------------------------------------------------------ */

function ConfirmEmail({
  email,
  redirectTo,
  onChangeEmail,
}: {
  email: string;
  redirectTo: string;
  onChangeEmail: () => void;
}) {
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const resend = async () => {
    if (pending || cooldown > 0) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (resendError) {
        setError(authErrorMessage(resendError, "resend"));
        return;
      }
      setCooldown(RESEND_COOLDOWN);
      setMessage("Un nouveau lien vient d'être envoyé.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      label="Presque terminé"
      title="Vérifiez votre boîte mail."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/connexion" className="font-medium text-primary underline-offset-4 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-600/10 text-emerald-700">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-foreground">
            Nous avons envoyé un lien de confirmation à{" "}
            <span className="font-medium break-all">{email}</span>.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Ouvrez-le depuis cet appareil pour activer votre espace. Rien après
          quelques minutes ? Regardez dans les indésirables.
        </p>

        <FormError message={error} />
        <div aria-live="polite">
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            onClick={() => void resend()}
            disabled={pending || cooldown > 0}
          >
            {pending
              ? "Envoi…"
              : cooldown > 0
                ? `Renvoyer l'e-mail (${cooldown} s)`
                : "Renvoyer l'e-mail"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-12 w-full"
            onClick={onChangeEmail}
          >
            Modifier l&apos;adresse e-mail
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  // `useSearchParams` impose une frontière Suspense (rendu statique).
  return (
    <React.Suspense>
      <SignupForm />
    </React.Suspense>
  );
}
