import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { NID_PLAN_IDS, nidPlan, type NidPlanId } from "@/features/nireo-id/plans";
import { createNidCheckout, nidPriceId } from "@/features/nireo-id/server/billing";
import { getNidSession } from "@/features/nireo-id/server/guards";
import { getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const runtime = "nodejs";

/**
 * POST /api/nireo-id/stripe/checkout — tunnel de paiement Nireo ID.
 *
 * Seul le propriétaire de l'espace peut souscrire. Aucun compte n'est
 * marqué payant ici : l'activation vient du webhook, après paiement
 * réellement encaissé.
 */
export async function POST(request: Request) {
  const session = await getNidSession();
  if (!session) {
    return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  }

  let body: { workspace_id?: string; plan?: string };
  try {
    body = (await request.json()) as { workspace_id?: string; plan?: string };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const workspaceId = body.workspace_id?.trim();
  const planId = body.plan?.trim() as NidPlanId | undefined;

  if (!workspaceId || !planId || !(NID_PLAN_IDS as readonly string[]).includes(planId)) {
    return NextResponse.json({ error: "Offre ou espace invalide." }, { status: 400 });
  }

  const context = await getWorkspaceContext(session.user.id, workspaceId);
  if (!context || context.role !== "owner") {
    return NextResponse.json(
      { error: "Seul le propriétaire de l'espace peut modifier l'abonnement." },
      { status: 403 }
    );
  }

  const plan = nidPlan(planId);
  if (plan.kind !== context.workspace.kind) {
    return NextResponse.json(
      { error: "Cette offre ne correspond pas au type de cet espace." },
      { status: 400 }
    );
  }
  if (plan.priceCents === 0) {
    return NextResponse.json({ error: "Cette offre est gratuite." }, { status: 400 });
  }

  if (!isStripeConfigured || !nidPriceId(planId)) {
    return NextResponse.json(
      {
        error:
          "provider_not_configured : le paiement Nireo ID sera disponible dès que les Price IDs Stripe du produit seront renseignés.",
      },
      { status: 503 }
    );
  }

  try {
    const outcome = await createNidCheckout({
      workspaceId,
      planId,
      customerEmail: session.email,
    });
    return NextResponse.json({ url: outcome.url });
  } catch (error) {
    logger.error("nireo-id/checkout", error);
    return NextResponse.json(
      { error: "La session de paiement n'a pas pu être créée." },
      { status: 500 }
    );
  }
}
