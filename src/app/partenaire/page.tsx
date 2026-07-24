import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedPartner } from "@/lib/marketing/partner-auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  jeton: "Jeton d'accès invalide ou révoqué. Vérifiez le lien fourni par Nireo.",
  limite: "Trop de tentatives. Patientez une minute avant de réessayer.",
  session: "Votre session a expiré. Reconnectez-vous avec votre lien d'accès.",
};

/**
 * Connexion à l'espace partenaire — accès par JETON (pas de compte Nireo).
 * Le formulaire envoie le jeton en GET à /partenaire/acces, qui pose le
 * cookie HttpOnly et redirige vers le tableau de bord.
 */
export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erreur?: string }>;
}) {
  // Déjà connecté (cookie valide) : aller directement au tableau de bord.
  if (await getAuthenticatedPartner()) redirect("/partenaire/tableau-de-bord");

  const { token, erreur } = await searchParams;
  const error = erreur ? (ERRORS[erreur] ?? "Accès impossible.") : null;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="size-5 text-primary" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Espace partenaire</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisissez votre jeton d&apos;accès (ou ouvrez le lien fourni par Nireo)
          pour consulter vos statistiques et vos commissions.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <form action="/partenaire/acces" method="get" className="mt-5 space-y-3">
          <Input
            name="token"
            defaultValue={token ?? ""}
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="Votre jeton d'accès"
            aria-label="Jeton d'accès partenaire"
            className="font-mono"
          />
          <Button type="submit" className="w-full">
            Accéder à mon espace
          </Button>
        </form>
      </div>
    </div>
  );
}
