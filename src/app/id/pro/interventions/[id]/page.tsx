import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RepairSubmitForm } from "@/components/nireo-id/repair-submit-form";
import { REPAIR_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatMoneyFromCents } from "@/features/nireo-id/format";
import { getProfessionalProfile, requireNidSession } from "@/features/nireo-id/server/guards";
import { getRepairOrder } from "@/features/nireo-id/server/repairs";
import { listWorkspaces } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intervention",
  robots: { index: false, follow: false },
};

export default async function InterventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/pro/interventions/${id}`);

  const [order, profile, spaces] = await Promise.all([
    getRepairOrder(id),
    getProfessionalProfile(session.user.id),
    listWorkspaces(session.user.id),
  ]);
  if (!order) notFound();

  // Contrôle d'accès explicite : l'atelier rattaché à CETTE intervention.
  const atelierIds = spaces
    .filter((item) => item.workspace.kind === "atelier")
    .map((item) => item.workspace.id);
  const allowed =
    (order.repairer_workspace_id !== null && atelierIds.includes(order.repairer_workspace_id)) ||
    (order.professional_id !== null && profile?.id === order.professional_id);
  if (!allowed) notFound();

  const expired = order.expires_at !== null && new Date(order.expires_at) <= new Date();
  const editable = !expired && order.status !== "termine" && order.status !== "annule";

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/id/pro" className="text-muted-foreground underline-offset-2 hover:underline">
          ← Espace atelier
        </Link>
      </p>

      <header className="nid-panel rounded-lg p-5">
        <h1 className="text-xl font-semibold text-foreground">{order.device}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{order.public_id}</p>
        <p className="mt-3 text-sm text-foreground">
          Statut : <strong>{REPAIR_STATUS_LABELS[order.status]}</strong>
        </p>
        {order.reported_problem ? (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">Problème annoncé par le client</p>
            <p className="mt-1 text-sm text-foreground">{order.reported_problem}</p>
          </div>
        ) : null}
        {order.expires_at ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Accès valable jusqu’au {new Date(order.expires_at).toLocaleDateString("fr-FR")}.
          </p>
        ) : null}
        {order.refused_at && order.refusal_reason ? (
          <p className="nid-note mt-3 rounded-xl p-3 text-sm">
            Le client demande une correction : {order.refusal_reason}
          </p>
        ) : null}
      </header>

      {order.status === "termine" ? (
        <section className="nid-panel rounded-lg p-5">
          <h2 className="font-medium text-foreground">Intervention validée par le client</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Diagnostic :</dt>
              <dd className="text-foreground">{order.diagnosis || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Opération :</dt>
              <dd className="text-foreground">{order.operation || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Montant :</dt>
              <dd className="text-foreground">
                {formatMoneyFromCents(order.amount_cents) || "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : expired ? (
        <p className="nid-panel rounded-lg p-5 text-sm text-muted-foreground">
          Cet accès a expiré. Demandez au client un nouveau lien pour compléter l’intervention.
        </p>
      ) : order.status === "en_attente_validation" ? (
        <p className="nid-panel rounded-lg p-5 text-sm text-muted-foreground">
          Intervention transmise. Le client doit la valider avant qu’elle rejoigne l’historique du
          téléphone. Vous pouvez encore la corriger tant qu’elle n’est pas validée.
        </p>
      ) : null}

      {editable ? (
        <RepairSubmitForm order={order} attestable={profile?.status === "approuve"} />
      ) : null}
    </div>
  );
}
