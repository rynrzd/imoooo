import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProAccessRequest } from "@/components/nireo-id/pro-access-request";
import { PRO_ACCESS_STATUS_LABELS, PRO_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatRemaining } from "@/features/nireo-id/format";
import { getProfessionalProfile, requireNidSession } from "@/features/nireo-id/server/guards";
import { listProfessionalAccess } from "@/features/nireo-id/server/professionals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Espace professionnel",
  robots: { index: false, follow: false },
};

export default async function ProfessionalHomePage() {
  const session = await requireNidSession("/id/pro");
  const profile = await getProfessionalProfile(session.user.id);

  if (!profile) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Espace professionnel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Réservé aux réparateurs, reconditionneurs et ateliers de diagnostic
            approuvés par Nireo.
          </p>
        </header>

        <div className="nid-panel nid-topline rounded-2xl p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Wrench className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Vous n’avez pas encore de compte professionnel
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Déposez une candidature : nom commercial, SIRET, responsable et
            activité. L’équipe Nireo l’examine et rend une décision motivée.
            Tant qu’elle n’est pas approuvée, vous ne pouvez enregistrer aucune
            intervention validée.
          </p>
          <div className="mt-5">
            <Button data-touch render={<Link href="/id/pro/candidature" />}>
              Déposer ma candidature
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const approved = profile.status === "approuve";
  const access = approved ? await listProfessionalAccess(profile.id) : [];
  const granted = access.filter((item) => item.status === "accorde");
  const waiting = access.filter((item) => item.status === "en_attente");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{profile.trade_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{session.email}</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            approved
              ? "border-[color-mix(in_srgb,var(--nid-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-success)_10%,transparent)] text-[var(--nid-success)]"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {approved ? <ShieldCheck className="size-3.5" /> : <Clock className="size-3.5" />}
          {PRO_STATUS_LABELS[profile.status]}
        </span>
      </header>

      {!approved ? (
        <div className="nid-panel rounded-2xl p-5">
          <p className="flex items-start gap-2.5 text-sm text-foreground">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-[var(--nid-warning)]"
              aria-hidden
            />
            <span>
              {profile.status === "en_attente"
                ? "Votre candidature est en attente d’examen. Vous ne pouvez pas encore accéder aux passeports ni enregistrer d’intervention."
                : profile.status === "refuse"
                  ? "Votre candidature n’a pas été retenue. Vous pouvez la corriger et la soumettre à nouveau."
                  : profile.status === "suspendu"
                    ? "Votre compte est suspendu : vos accès aux passeports ont été révoqués."
                    : "Votre candidature est en brouillon."}
            </span>
          </p>
          {profile.decision_reason ? (
            <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              {profile.decision_reason}
            </p>
          ) : null}
          {["brouillon", "en_attente", "refuse"].includes(profile.status) ? (
            <div className="mt-4">
              <Button variant="outline" data-touch render={<Link href="/id/pro/candidature" />}>
                Modifier ma candidature
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {approved ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-foreground">
              Passeports accessibles ({granted.length})
            </h2>
            {granted.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                Aucun passeport ouvert. Demandez l’accès avec l’identifiant que
                votre client vous communique, ou attendez qu’il vous invite
                depuis son espace.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {granted.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/id/pro/objets/${item.asset_id}`}
                      className="nid-panel flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.asset?.brand} {item.asset?.model}
                        </span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {item.asset?.public_id}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Accès expirant dans {formatRemaining(item.expires_at)}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {waiting.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-foreground">
                Demandes en attente ({waiting.length})
              </h2>
              <ul className="mt-3 space-y-2">
                {waiting.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span className="text-foreground">
                      {item.asset?.brand} {item.asset?.model}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.asset?.public_id}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {PRO_ACCESS_STATUS_LABELS[item.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ProAccessRequest />
        </>
      ) : null}

      <p className="rounded-2xl border border-border bg-card p-5 text-xs leading-relaxed text-muted-foreground">
        Un professionnel ne peut jamais parcourir la base Nireo ID. L’accès à
        un passeport suppose toujours une autorisation explicite de son
        propriétaire, limitée dans le temps et révocable. Une intervention
        erronée se corrige par une révocation motivée, jamais par une
        suppression.
      </p>
    </div>
  );
}
