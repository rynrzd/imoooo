import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/features/nireo-id/server/workspaces";
import { getFleetSummary, listFleet } from "@/features/nireo-id/server/fleet";
import { getWorkspaceCheckBoard } from "@/features/nireo-id/server/checkups";
import { listRepairsForWorkspace } from "@/features/nireo-id/server/repairs";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { nidPlan, remainingAssets } from "@/features/nireo-id/plans";

export const dynamic = "force-dynamic";

/** Quatre indicateurs maximum, puis ce qui demande une action réelle. */
export default async function CompanyOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context) notFound();

  const [summary, fleet, board, repairs] = await Promise.all([
    getFleetSummary(context),
    listFleet(id),
    getWorkspaceCheckBoard(id),
    listRepairsForWorkspace(id),
  ]);

  const plan = nidPlan(context.workspace.plan);
  const left = remainingAssets(plan, summary.total);
  const toValidate = repairs.filter((order) => order.status === "en_attente_validation");
  const unassigned = fleet.filter((item) => item.fleet_status === "en_stock");

  const stats = [
    { label: "Téléphones", value: summary.total },
    { label: "Affectés", value: summary.assigned },
    { label: "Problèmes ouverts", value: summary.problems },
    { label: "Bilans en retard", value: board.overdue.length },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{context.workspace.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Offre {plan.label}
            {left !== null ? ` · ${left} téléphone${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <Button render={<Link href={`/id/app/objets/nouveau?espace=${id}`} />}>
          Ajouter un téléphone
        </Button>
      </header>

      <section aria-label="Indicateurs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="nid-panel rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">Actions demandant votre attention</h2>

        {toValidate.length === 0 &&
        board.overdue.length === 0 &&
        summary.problems === 0 &&
        unassigned.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Rien à traiter pour le moment. Le parc est à jour.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {toValidate.length > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4">
                <span className="text-foreground">
                  {toValidate.length} intervention{toValidate.length > 1 ? "s" : ""} en attente de
                  validation
                </span>
                <Button size="sm" render={<Link href={`/id/entreprise/${id}/reparations`} />}>
                  Vérifier
                </Button>
              </li>
            ) : null}

            {board.overdue.length > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4">
                <span className="text-foreground">
                  {board.overdue.length} bilan{board.overdue.length > 1 ? "s" : ""} en retard
                </span>
                <Button size="sm" render={<Link href={`/id/entreprise/${id}/bilans`} />}>
                  Relancer
                </Button>
              </li>
            ) : null}

            {summary.problems > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4">
                <span className="text-foreground">
                  {summary.problems} téléphone{summary.problems > 1 ? "s" : ""} avec un problème
                  déclaré
                </span>
                <Button size="sm" render={<Link href={`/id/entreprise/${id}/parc`} />}>
                  Voir
                </Button>
              </li>
            ) : null}

            {unassigned.length > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4">
                <span className="text-foreground">
                  {unassigned.length} téléphone{unassigned.length > 1 ? "s" : ""} en stock, sans
                  détenteur
                </span>
                <Button size="sm" render={<Link href={`/id/entreprise/${id}/affectations`} />}>
                  Affecter
                </Button>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {summary.warranty_soon > 0 ? (
        <p className="nid-note rounded-lg p-4 text-sm">
          {summary.warranty_soon} garantie{summary.warranty_soon > 1 ? "s" : ""} arrive
          {summary.warranty_soon > 1 ? "nt" : ""} à échéance dans moins de 60 jours —{" "}
          <Link href={`/id/entreprise/${id}/rapports`} className="underline underline-offset-2">
            voir le rapport
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
