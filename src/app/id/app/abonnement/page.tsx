import type { Metadata } from "next";
import Link from "next/link";
import { SubscriptionPanel } from "@/components/nireo-id/subscription-panel";
import { nidPlan, nidPlansForKind } from "@/features/nireo-id/plans";
import { isNidBillingReady } from "@/features/nireo-id/server/billing";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { getActiveWorkspace, getWorkspaceContext } from "@/features/nireo-id/server/workspaces";
import { listFleet } from "@/features/nireo-id/server/fleet";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Abonnement" };

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ paiement?: string; espace?: string }>;
}) {
  const session = await requireNidSession("/id/app/abonnement");
  const { paiement, espace } = await searchParams;

  // L'espace ciblé est vérifié en base : le paramètre d'URL n'ouvre rien.
  const active = espace
    ? ((await getWorkspaceContext(session.user.id, espace)) ??
      (await getActiveWorkspace(session.user.id)))
    : await getActiveWorkspace(session.user.id);

  if (!active) {
    return (
      <div className="nid-panel rounded-2xl p-5">
        <h1 className="font-medium text-foreground">Abonnement</h1>
        <p className="mt-2 text-sm text-muted-foreground">Aucun espace actif.</p>
      </div>
    );
  }

  const plan = nidPlan(active.workspace.plan);
  const plans = nidPlansForKind(active.workspace.kind).map((item) => ({
    ...item,
    purchasable: isNidBillingReady(item.id),
  }));
  const fleet = await listFleet(active.workspace.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Abonnement Nireo ID</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Espace{" "}
          <strong className="text-foreground">
            {active.workspace.kind === "personnel" ? "personnel" : active.workspace.name}
          </strong>{" "}
          · offre actuelle : {plan.label}
          {plan.maxAssets !== null
            ? ` · ${fleet.length} / ${plan.maxAssets} téléphones`
            : ` · ${fleet.length} téléphones`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          L’abonnement Nireo ID est indépendant de Nireo Immo : un abonnement à l’un ne débloque
          jamais l’autre.
        </p>
      </header>

      {paiement === "ok" ? (
        <p className="nid-note rounded-2xl p-4 text-sm">
          Paiement transmis à Stripe. Votre offre sera mise à jour dès la confirmation du
          paiement — cette page reflétera alors le nouveau plan.
        </p>
      ) : null}
      {paiement === "annule" ? (
        <p className="nid-note rounded-2xl p-4 text-sm">
          Paiement annulé. Rien n’a été débité et votre offre est inchangée.
        </p>
      ) : null}
      {active.workspace.plan_status === "impaye" ? (
        <p className="rounded-2xl border border-[color-mix(in_srgb,var(--nid-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-warning)_10%,transparent)] p-4 text-sm text-foreground">
          Un paiement n’a pas abouti. Régularisez depuis votre espace de facturation Stripe pour
          conserver l’offre en cours.
        </p>
      ) : null}

      <SubscriptionPanel
        workspaceId={active.workspace.id}
        currentPlan={plan.id}
        plans={plans}
        isOwner={active.role === "owner"}
      />

      <p className="text-sm text-muted-foreground">
        La création d’un téléphone, la consultation de son historique et le transfert restent
        gratuits, quelle que soit l’offre.{" "}
        <Link href="/id#tarifs" className="text-primary underline underline-offset-2">
          Voir le détail des offres
        </Link>
      </p>
    </div>
  );
}
