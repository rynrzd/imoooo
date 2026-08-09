import type { Metadata } from "next";
import Link from "next/link";
import { ProfessionalApplicationForm } from "@/components/nireo-id/professional-application-form";
import { PRO_STATUS_LABELS } from "@/features/nireo-id/constants";
import { getProfessionalProfile, requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Candidature professionnelle",
  robots: { index: false, follow: false },
};

export default async function ProfessionalApplicationPage() {
  const session = await requireNidSession("/id/pro/candidature");
  const profile = await getProfessionalProfile(session.user.id);

  const locked = profile && ["approuve", "suspendu"].includes(profile.status);

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/id/pro" className="text-muted-foreground underline-offset-2 hover:underline">
          ← Espace professionnel
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Demander un compte professionnel
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre candidature est examinée par l’équipe Nireo. Tant qu’elle n’est
          pas approuvée, aucune intervention ne peut être enregistrée comme
          validée par un professionnel.
        </p>
      </header>

      {profile ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm">
          <span className="text-muted-foreground">Statut actuel : </span>
          <span className="font-medium text-foreground">
            {PRO_STATUS_LABELS[profile.status]}
          </span>
          {profile.decision_reason ? (
            <span className="mt-2 block text-muted-foreground">{profile.decision_reason}</span>
          ) : null}
        </p>
      ) : null}

      {locked ? (
        <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Votre compte professionnel est {PRO_STATUS_LABELS[profile.status].toLowerCase()} :
          il n’est plus modifiable ici. Contactez l’équipe Nireo pour toute
          mise à jour de vos informations.
        </p>
      ) : (
        <ProfessionalApplicationForm profile={profile} defaultEmail={session.email} />
      )}
    </div>
  );
}
