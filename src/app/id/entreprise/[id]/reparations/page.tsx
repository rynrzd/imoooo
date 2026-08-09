import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REPAIR_STATUSES, REPAIR_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatMoneyFromCents } from "@/features/nireo-id/format";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { groupRepairs, listRepairsForWorkspace } from "@/features/nireo-id/server/repairs";
import { getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Réparations" };

export default async function CompanyRepairsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/reparations`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context) notFound();

  const orders = await listRepairsForWorkspace(id);
  const groups = groupRepairs(orders);
  const totalCost = orders
    .filter((order) => order.status === "termine")
    .reduce((sum, order) => sum + (order.amount_cents ?? 0), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Réparations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orders.length === 0
            ? "Aucune réparation enregistrée."
            : `${orders.length} intervention${orders.length > 1 ? "s" : ""} · ${formatMoneyFromCents(totalCost) || "0 €"} de coût enregistré.`}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Une réparation se déclare depuis la fiche d’un téléphone du parc.
        </p>
      </header>

      {REPAIR_STATUSES.filter((status) => status !== "annule").map((status) => {
        const list = groups[status];
        return (
          <section key={status} className="nid-panel rounded-lg p-5">
            <h2 className="font-medium text-foreground">
              {REPAIR_STATUS_LABELS[status]}{" "}
              <span className="text-muted-foreground">({list.length})</span>
            </h2>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucune intervention.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-sm">
                {list.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <Link
                      href={`/id/app/objets/${order.asset_id}#reparations`}
                      className="min-w-0 flex-1 truncate text-foreground underline-offset-2 hover:underline"
                    >
                      {order.device}
                    </Link>
                    {order.repairer_label ? (
                      <span className="text-xs text-muted-foreground">{order.repairer_label}</span>
                    ) : null}
                    {order.amount_cents !== null ? (
                      <span className="text-xs text-foreground">
                        {formatMoneyFromCents(order.amount_cents)}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
