import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CsvExportButton } from "@/components/nireo-id/csv-export-button";
import {
  FLEET_STATUS_LABELS,
  HEALTH_STATE_LABELS,
} from "@/features/nireo-id/constants";
import { formatMoneyFromCents } from "@/features/nireo-id/format";
import { planHasEntitlement } from "@/features/nireo-id/plans";
import { listAssignments, listFleet } from "@/features/nireo-id/server/fleet";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listRepairsForWorkspace } from "@/features/nireo-id/server/repairs";
import { canManageFleet, getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Rapports" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("fr-FR");
}

export default async function CompanyReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/rapports`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context || !canManageFleet(context.role)) notFound();

  const [fleet, repairs, assignments] = await Promise.all([
    listFleet(id),
    listRepairsForWorkspace(id),
    listAssignments(id),
  ]);

  const canExport = planHasEntitlement(context.workspace.plan, "exports");
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  const soonISO = soon.toISOString().slice(0, 10);

  const noRecentCheck = fleet.filter((item) => item.check_overdue || !item.last_checkup_at);
  const warrantyEnding = fleet.filter(
    (item) => item.warranty_end !== null && item.warranty_end <= soonISO
  );
  const finished = repairs.filter((order) => order.status === "termine");
  const totalCost = finished.reduce((sum, order) => sum + (order.amount_cents ?? 0), 0);
  const deviceById = new Map(fleet.map((item) => [item.id, `${item.brand} ${item.model}`]));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Rapports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les exports ne contiennent jamais un IMEI ou un numéro de série complet.
        </p>
        {canExport ? null : (
          <p className="nid-note mt-3 rounded-xl p-3 text-sm">
            Les exports sont inclus à partir de l’offre Entreprise Équipe. Les rapports restent
            consultables ici.
          </p>
        )}
      </header>

      {/* État du parc */}
      <section className="nid-panel rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-foreground">État du parc ({fleet.length})</h2>
          {canExport ? (
            <CsvExportButton
              filename="nireo-id-parc.csv"
              header={[
                "telephone",
                "reference_interne",
                "identifiant_partiel",
                "statut",
                "etat",
                "detenteur",
                "dernier_bilan",
                "fin_garantie",
              ]}
              rows={fleet.map((item) => [
                `${item.brand} ${item.model}`,
                item.internal_reference,
                item.imei_last4 || item.serial_last4 ? `••••${item.imei_last4 || item.serial_last4}` : "",
                FLEET_STATUS_LABELS[item.fleet_status],
                HEALTH_STATE_LABELS[item.health_state],
                item.holder_label ?? "",
                item.last_checkup_at ? formatDate(item.last_checkup_at) : "",
                item.warranty_end ? formatDate(item.warranty_end) : "",
              ])}
            />
          ) : null}
        </div>
        {fleet.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun téléphone.</p>
        ) : (
          <div className="nid-scroll-x mt-3">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Téléphone</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 pr-3 font-medium">État</th>
                  <th className="py-2 pr-3 font-medium">Détenteur</th>
                  <th className="py-2 font-medium">Dernier bilan</th>
                </tr>
              </thead>
              <tbody>
                {fleet.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 text-foreground">
                      {item.brand} {item.model}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {FLEET_STATUS_LABELS[item.fleet_status]}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {HEALTH_STATE_LABELS[item.health_state]}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {item.holder_label ?? "—"}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {item.last_checkup_at ? formatDate(item.last_checkup_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sans bilan récent */}
      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">
          Téléphones sans bilan récent ({noRecentCheck.length})
        </h2>
        {noRecentCheck.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Tous les bilans sont à jour.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {noRecentCheck.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {item.brand} {item.model}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.last_checkup_at
                    ? `Dernier bilan le ${formatDate(item.last_checkup_at)}`
                    : "Aucun bilan"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Réparations et coûts */}
      <section className="nid-panel rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-foreground">
            Réparations et coûts ({finished.length}) — {formatMoneyFromCents(totalCost) || "0 €"}
          </h2>
          {canExport ? (
            <CsvExportButton
              filename="nireo-id-reparations.csv"
              header={["telephone", "atelier", "date", "montant_euros", "garantie_mois"]}
              rows={finished.map((order) => [
                order.device,
                order.repairer_label,
                order.intervened_on ?? "",
                order.amount_cents === null ? "" : (order.amount_cents / 100).toFixed(2),
                order.warranty_months ?? "",
              ])}
            />
          ) : null}
        </div>
        {finished.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune réparation terminée.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {finished.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">{order.device}</span>
                <span className="text-xs text-muted-foreground">{order.repairer_label}</span>
                <span className="text-xs text-foreground">
                  {formatMoneyFromCents(order.amount_cents) || "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(order.intervened_on)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Garanties */}
      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">
          Garanties proches de la fin ({warrantyEnding.length})
        </h2>
        {warrantyEnding.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucune garantie n’arrive à échéance dans les 60 prochains jours.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {warrantyEnding.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {item.brand} {item.model}
                </span>
                <span className="text-xs text-muted-foreground">
                  Fin le {formatDate(item.warranty_end)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historique d'affectation */}
      <section className="nid-panel rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-foreground">
            Historique d’affectation ({assignments.length})
          </h2>
          {canExport ? (
            <CsvExportButton
              filename="nireo-id-affectations.csv"
              header={["telephone", "detenteur", "type", "du", "au", "statut"]}
              rows={assignments.map((assignment) => [
                deviceById.get(assignment.asset_id) ?? "",
                assignment.holder_name || assignment.holder_email,
                assignment.kind,
                assignment.started_on,
                assignment.ended_on ?? "",
                assignment.status,
              ])}
            />
          ) : null}
        </div>
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune affectation enregistrée.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {assignments.slice(0, 50).map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {deviceById.get(assignment.asset_id) ?? "Téléphone"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {assignment.holder_name || assignment.holder_email || "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(assignment.started_on)} → {formatDate(assignment.ended_on)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
