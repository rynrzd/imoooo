import type { Metadata } from "next";
import Link from "next/link";
import { AdminDecisionForm } from "@/components/nireo-id/admin-decision-form";
import { decideProfessionalAction } from "@/features/nireo-id/actions/admin";
import { PRO_ACTIVITY_LABELS, PRO_STATUSES, PRO_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatDateTime } from "@/features/nireo-id/format";
import { listProfessionalApplications } from "@/features/nireo-id/server/admin";
import { requireNidAdminPage } from "@/features/nireo-id/server/guards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Professionnels" };

export default async function AdminProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await requireNidAdminPage();
  const { statut } = await searchParams;
  // Filtre issu de l'URL : on ne retient qu'une valeur connue du domaine.
  const filter = PRO_STATUSES.find((status) => status === statut);
  const applications = await listProfessionalApplications(filter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Comptes professionnels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approuver, refuser ou suspendre un compte. Chaque décision est
          motivée, notifiée par e-mail si le service d’envoi est configuré, et
          journalisée.
        </p>
      </header>

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        <Link
          href="/id/admin/professionnels"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs transition-colors",
            !filter ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Tous
        </Link>
        {PRO_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/id/admin/professionnels?statut=${status}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              filter === status
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {PRO_STATUS_LABELS[status]}
          </Link>
        ))}
      </nav>

      {applications.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Aucune candidature{filter ? ` au statut « ${PRO_STATUS_LABELS[filter]} »` : ""}.
        </p>
      ) : (
        <ul className="space-y-3">
          {applications.map((application) => (
            <li key={application.id} className="nid-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {application.trade_name}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {PRO_ACTIVITY_LABELS[application.activity]} · Déposée le{" "}
                    {formatDateTime(application.created_at)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                  {PRO_STATUS_LABELS[application.status]}
                </span>
              </div>

              <dl className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                {[
                  { label: "Raison sociale", value: application.legal_name || "—" },
                  { label: "SIRET", value: application.siret || "—" },
                  { label: "Responsable", value: application.manager_name },
                  { label: "E-mail", value: application.contact_email },
                  { label: "Téléphone", value: application.contact_phone || "—" },
                  {
                    label: "Adresse",
                    value:
                      [application.address, application.postal_code, application.city]
                        .filter(Boolean)
                        .join(", ") || "—",
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-card px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                    <dd className="mt-0.5 text-sm break-words text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {application.decision_reason ? (
                <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Décision précédente : {application.decision_reason}
                  {application.decided_at ? ` (${formatDateTime(application.decided_at)})` : ""}
                </p>
              ) : null}

              <AdminDecisionForm
                action={decideProfessionalAction}
                idField="professional_id"
                idValue={application.id}
                reasonField="reason"
                reasonLabel="Motif de la décision"
                successMessage="Décision enregistrée."
                options={[
                  { value: "approuve", label: "Approuver", variant: "default" },
                  { value: "refuse", label: "Refuser" },
                  {
                    value: "suspendu",
                    label: "Suspendre",
                    variant: "destructive",
                    confirm:
                      "Suspendre ce compte ? Tous ses accès aux passeports seront immédiatement révoqués.",
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
