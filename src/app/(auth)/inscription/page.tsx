"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { trackFunnel } from "@/lib/funnel";
import { PRIMARY_CTA_LABEL } from "@/lib/landing/cta";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/**
 * Création de compte — DEUX CHAMPS.
 *
 * Ne sont demandées que les informations sans lesquelles Supabase Auth ne
 * peut pas créer le compte : une adresse e-mail et un mot de passe. Le nom, le
 * téléphone, l'entreprise ou la SCI se renseignent plus tard dans
 * Paramètres → Profil (`profiles.full_name` a une valeur par défaut vide en
 * base, aucun écran ne dépend de sa présence). Aucun plan, aucune carte,
 * aucune donnée de facturation, aucune question sur la taille du patrimoine :
 * tout nouveau compte est sur le plan Gratuit, qui est simplement l'absence
 * d'abonnement (cf. `DEFAULT_PLAN_ID` dans src/config/plans.ts).
 *
 * Rien n'a été retiré côté sécurité : mot de passe de 8 caractères minimum
 * (règle Supabase du projet) avec indicateur de force, validation Zod avant
 * envoi, confirmation d'e-mail obligatoire, réponse identique que l'adresse
 * existe ou non (aucune énumération de comptes).
 */

const schema = z.object({
  email: z.string().email("E-mail invalide."),
  password: z.string().min(8, "8 caractères minimum."),
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
const SCORE_COLOR = ["bg-white/10", "bg-rose-400", "bg-amber-400", "bg-sky-400", "bg-emerald-400"];

function PasswordStrength({ value }: { value: string }) {
  const score = passwordScore(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= score ? SCORE_COLOR[score] : "bg-white/10")} />
        ))}
      </div>
      {value ? <p className="mt-1.5 text-[11px] text-muted-foreground">Sécurité : <span className="text-foreground">{SCORE_LABEL[score]}</span></p> : null}
    </div>
  );
}

/** Destination après inscription : uniquement un chemin interne. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [pending, setPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [showPw, setShowPw] = React.useState(false);

  // Tunnel de conversion : « inscription démarrée » (anonyme, non bloquant,
  // dédoublonné — React Strict Mode monte ce composant deux fois).
  React.useEffect(() => {
    trackFunnel("signup_started");
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(async (values) => {
    if (pending) return;
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // `next` permet à un autre produit Nireo (ex. Nireo ID) de ramener
        // l'utilisateur à son parcours après confirmation. Sans destination
        // particulière, le compte confirmé arrive directement dans son
        // espace, sur l'ajout du premier logement.
        emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error, "signup"));
      return;
    }
    if (data.session) {
      // Confirmation d'e-mail désactivée : la session est immédiate.
      window.location.assign(next);
      return;
    }
    setSentTo(values.email);
  });

  return (
    <AuthShell
      title="Créer votre espace"
      description="Deux informations suffisent : votre e-mail et un mot de passe."
      footer={
        <p>
          Déjà un compte ?{" "}
          <Link
            href={next === "/" ? "/connexion" : `/connexion?next=${encodeURIComponent(next)}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      {sentTo ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-emerald-400/12 text-emerald-300">
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
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="vous@exemple.fr" aria-invalid={!!errors.email} {...register("email")} />
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

          <Button type="submit" className="nireo-sheen w-full" disabled={!isSupabaseConfigured || pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Création…
              </>
            ) : (
              PRIMARY_CTA_LABEL
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Gratuit pour 1 logement. Aucune carte demandée.
          </p>

          {/* Acceptation par l'acte de création — l'ancienne case à cocher
              obligatoire a disparu, les deux textes restent accessibles d'un
              clic depuis l'endroit exact où l'engagement est pris. */}
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            En créant votre espace, vous acceptez les{" "}
            <Link href="/cgu" target="_blank" className="text-foreground underline-offset-2 hover:underline">conditions d’utilisation</Link>{" "}
            et la{" "}
            <Link href="/confidentialite" target="_blank" className="text-foreground underline-offset-2 hover:underline">politique de confidentialité</Link>.
          </p>
        </form>
      )}
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
