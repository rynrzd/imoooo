import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FleetBoard } from "@/components/nireo-id/fleet-board";
import { planHasEntitlement } from "@/features/nireo-id/plans";
import { listAssignments, listFleet } from "@/features/nireo-id/server/fleet";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { canManageFleet, getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Affectations" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR");
}

export default async function CompanyAssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/affectations`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context) notFound();

  const [items, assignments] = await Promise.all([listFleet(id), listAssignments(id)]);
  const canManage = canManageFleet(context.role);
  const deviceById = new Map(items.map((item) => [item.id, `${item.brand} ${item.model}`]));

  const history = assignments.filter((assignment) => assignment.status === "ended");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Affectations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Une affectation désigne la personne qui utilise le téléphone. Elle ne transfère jamais la
          propriété : un retour ne change rien au propriétaire ni à l’historique.
        </p>
      </header>

      <FleetBoard
        workspaceId={id}
        items={items}
        canManage={canManage}
        canRunCampaign={canManage && planHasEntitlement(context.workspace.plan, "campagnes")}
      />

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">Historique des affectations</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune affectation terminée.</p>
        ) : (
          <div className="nid-scroll-x mt-3">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Téléphone
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Détenteur
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Du
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Au
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 text-foreground">
                      {deviceById.get(assignment.asset_id) ?? "Téléphone"}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground">
                      {assignment.holder_name || assignment.holder_email || "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {formatDate(assignment.started_on)}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {formatDate(assignment.ended_on)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
