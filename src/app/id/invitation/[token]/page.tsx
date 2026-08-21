import type { Metadata } from "next";
import Link from "next/link";
import { InviteDecision } from "@/components/nireo-id/invite-decision";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { getNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

/**
 * Acceptation d'une invitation à rejoindre un espace.
 * Le jeton n'est jamais lu ici : il est transmis à la Server Action qui
 * le compare à son empreinte en base.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getNidSession();

  return (
    <main id="contenu" tabIndex={-1} className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <NidLogo href="/id" />
      </div>

      <div className="nid-panel rounded-lg p-6">
        <h1 className="text-xl font-semibold text-foreground">Rejoindre un espace Nireo ID</h1>

        {session ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous êtes connecté avec <strong className="text-foreground">{session.email}</strong>.
              L’invitation doit avoir été envoyée à cette adresse.
            </p>
            <div className="mt-5">
              <InviteDecision token={token} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous (ou créez votre compte Nireo) avec l’adresse qui a reçu l’invitation,
              puis revenez sur ce lien.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/connexion?next=${encodeURIComponent(`/id/invitation/${token}`)}`}
                data-touch
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Se connecter
              </Link>
              <Link
                href={`/inscription?next=${encodeURIComponent(`/id/invitation/${token}`)}`}
                data-touch
                className="inline-flex items-center rounded-xl border border-border px-4 py-2.5 text-sm text-foreground"
              >
                Créer un compte
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
