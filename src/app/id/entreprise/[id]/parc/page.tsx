import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FleetBoard } from "@/components/nireo-id/fleet-board";
import { planHasEntitlement } from "@/features/nireo-id/plans";
import { listFleet } from "@/features/nireo-id/server/fleet";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { canManageFleet, getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Parc" };

export default async function CompanyFleetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/parc`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context) notFound();

  const items = await listFleet(id);
  const canManage = canManageFleet(context.role);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Parc</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0
              ? "Aucun téléphone enregistré."
              : `${items.length} téléphone${items.length > 1 ? "s" : ""}.`}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href={`/id/app/objets/nouveau?espace=${id}`} />}>
              Ajouter un téléphone
            </Button>
            <Button variant="outline" render={<Link href={`/id/entreprise/${id}/import`} />}>
              Importer un CSV
            </Button>
          </div>
        ) : null}
      </header>

      <FleetBoard
        workspaceId={id}
        items={items}
        canManage={canManage}
        canRunCampaign={canManage && planHasEntitlement(context.workspace.plan, "campagnes")}
      />
    </div>
  );
}
