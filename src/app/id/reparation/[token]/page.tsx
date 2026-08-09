import type { Metadata } from "next";
import Link from "next/link";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { RepairClaim } from "@/components/nireo-id/repair-claim";
import { getNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intervention",
  robots: { index: false, follow: false },
};

/**
 * Lien remis à l'atelier par le client.
 * Un compte Nireo est nécessaire (pour tracer l'auteur de l'intervention),
 * mais AUCUN abonnement n'est requis pour compléter l'historique.
 */
export default async function RepairLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getNidSession();
  const next = `/id/reparation/${token}`;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <NidLogo href="/id" />
      </div>

      <div className="nid-panel rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-foreground">Une intervention vous est confiée</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce lien donne accès à une seule intervention, pendant une durée limitée. Vous ne voyez ni
          les documents privés du client, ni ses autres téléphones.
        </p>

        {session ? (
          <div className="mt-5">
            <RepairClaim token={token} />
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Connectez-vous avec votre compte Nireo (ou créez-en un, gratuitement) pour compléter
              l’intervention.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/connexion?next=${encodeURIComponent(next)}`}
                data-touch
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Se connecter
              </Link>
              <Link
                href={`/inscription?next=${encodeURIComponent(next)}`}
                data-touch
                className="inline-flex items-center rounded-xl border border-border px-4 py-2.5 text-sm text-foreground"
              >
                Créer un compte
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Nireo ne certifie pas une intervention automatiquement : elle est « attestée par un
        réparateur » uniquement si votre identité professionnelle est approuvée.
      </p>
    </main>
  );
}
