import type { Metadata } from "next";
import Link from "next/link";
import { AdminDecisionForm } from "@/components/nireo-id/admin-decision-form";
import { TrustBadge } from "@/components/nireo-id/trust-badge";
import { decideDisputeAction } from "@/features/nireo-id/actions/admin";
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUSES,
  DISPUTE_STATUS_LABELS,
} from "@/features/nireo-id/constants";
import { formatDateTime, formatEventDate } from "@/features/nireo-id/format";
import { listDisputes } from "@/features/nireo-id/server/admin";
import { requireNidAdminPage } from "@/features/nireo-id/server/guards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Signalements" };

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await requireNidAdminPage();
  const { statut } = await searchParams;
  // Filtre issu de l'URL : on ne retient qu'une valeur connue du domaine.
  const filter = DISPUTE_STATUSES.find((status) => status === statut);
  const disputes = await listDisputes(filter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Signalements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contexte minimal nécessaire à la décision : ni documents privés, ni
          identifiants complets, ni identité du propriétaire.
        </p>
      </header>

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        <Link
          href="/id/admin/signalements"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs transition-colors",
            !filter
              ? "border-primary bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Tous
        </Link>
        {DISPUTE_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/id/admin/signalements?statut=${status}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              filter === status
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {DISPUTE_STATUS_LABELS[status]}
          </Link>
        ))}
      </nav>

      {disputes.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Aucun signalement{filter ? ` au statut « ${DISPUTE_STATUS_LABELS[filter]} »` : ""}.
        </p>
      ) : (
        <ul className="space-y-3">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="nid-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {DISPUTE_REASON_LABELS[dispute.reason]}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Signalé le {formatDateTime(dispute.created_at)}
                    {dispute.asset
                      ? ` · ${dispute.asset.brand} ${dispute.asset.model} (${dispute.asset.public_id})`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                  {DISPUTE_STATUS_LABELS[dispute.status]}
                </span>
              </div>

              <p className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                {dispute.description}
              </p>

              {dispute.event ? (
                <div className="mt-3 rounded-xl border border-border p-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    Événement visé : {dispute.event.title}
                    <TrustBadge level={dispute.event.trust_level} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatEventDate(dispute.event.effective_date)}
                  </p>
                </div>
              ) : null}

              {dispute.resolution ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Résolution : {dispute.resolution}
                  {dispute.handled_at ? ` (${formatDateTime(dispute.handled_at)})` : ""}
                </p>
              ) : null}

              <AdminDecisionForm
                action={decideDisputeAction}
                idField="dispute_id"
                idValue={dispute.id}
                reasonField="resolution"
                reasonLabel="Motif / résolution"
                successMessage="Signalement traité."
                extraCheckbox={
                  dispute.event_id
                    ? {
                        name: "mark_event_disputed",
                        label:
                          "Marquer l’événement « Contesté » (l’information reste visible mais n’est plus présentée comme fiable)",
                      }
                    : undefined
                }
                options={[
                  { value: "en_examen", label: "Mettre en examen" },
                  { value: "resolu", label: "Résoudre", variant: "default" },
                  { value: "rejete", label: "Rejeter" },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
