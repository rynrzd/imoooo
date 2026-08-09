import type Stripe from "stripe";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { SITE_URL } from "@/lib/supabase/config";
import { NID_PLANS, type NidPlanId } from "../plans";
import { recordNidAudit } from "./audit";
import { isNireoIdConfigured, nidService } from "./client";

/**
 * Abonnements Nireo ID — INDÉPENDANTS de Nireo Immo.
 *
 * Règles appliquées ici :
 *  • Price IDs propres à Nireo ID (variables NIREO_ID_STRIPE_PRICE_*) :
 *    un abonnement Immo ne débloque jamais Nireo ID, et inversement ;
 *  • aucun plan n'est activé sans un événement Stripe réellement payé ;
 *  • webhook idempotent (`nid_stripe_events`) : un événement rejoué ne
 *    modifie rien une seconde fois ;
 *  • tant que la configuration est incomplète, le paiement est désactivé
 *    proprement — aucun compte n'est marqué payant.
 */

/** Price ID d'une offre, ou null si la variable n'est pas renseignée. */
export function nidPriceId(planId: NidPlanId): string | null {
  const envVar = NID_PLANS[planId].priceEnv;
  if (!envVar) return null;
  return process.env[envVar]?.trim() || null;
}

/** Offre correspondant à un Price ID (webhook). */
export function nidPlanFromPriceId(priceId: string): NidPlanId | null {
  for (const plan of Object.values(NID_PLANS)) {
    if (!plan.priceEnv) continue;
    if (process.env[plan.priceEnv]?.trim() === priceId) return plan.id;
  }
  return null;
}

/** Le paiement Nireo ID est-il réellement utilisable pour cette offre ? */
export function isNidBillingReady(planId: NidPlanId): boolean {
  return isStripeConfigured && nidPriceId(planId) !== null;
}

export function nidWebhookSecret(): string | null {
  return process.env.NIREO_ID_STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/* ------------------------------------------------------------------ */
/*  Tunnel de paiement                                                 */
/* ------------------------------------------------------------------ */

export interface CheckoutOutcome {
  url: string;
}

/**
 * Session Checkout pour un espace. Aucune activation n'a lieu ici : seul
 * le webhook, après paiement réellement encaissé, change le plan.
 */
export async function createNidCheckout(options: {
  workspaceId: string;
  planId: NidPlanId;
  customerEmail: string;
}): Promise<CheckoutOutcome> {
  const priceId = nidPriceId(options.planId);
  if (!isStripeConfigured || !priceId) {
    throw new Error(
      "Le paiement Nireo ID n'est pas encore disponible : la configuration Stripe du produit est incomplète."
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: options.customerEmail,
    client_reference_id: options.workspaceId,
    // Le produit et l'espace concernés sont portés par les métadonnées :
    // le webhook n'a jamais à deviner.
    metadata: {
      product: "nireo-id",
      workspace_id: options.workspaceId,
      plan: options.planId,
    },
    subscription_data: {
      metadata: {
        product: "nireo-id",
        workspace_id: options.workspaceId,
        plan: options.planId,
      },
    },
    success_url: `${SITE_URL}/id/app/abonnement?paiement=ok`,
    cancel_url: `${SITE_URL}/id/app/abonnement?paiement=annule`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  }
  return { url: session.url };
}

/* ------------------------------------------------------------------ */
/*  Webhook                                                            */
/* ------------------------------------------------------------------ */

/** Événement déjà traité ? (idempotence stricte) */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const { data } = await nidService()
    .from("nid_stripe_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

async function markProcessed(
  eventId: string,
  type: string,
  workspaceId: string | null
): Promise<void> {
  await nidService()
    .from("nid_stripe_events")
    .insert({ event_id: eventId, type, workspace_id: workspaceId });
}

async function applyPlan(
  workspaceId: string,
  planId: NidPlanId,
  subscription: { id?: string; customer?: string; current_period_end?: number } | null,
  status: "actif" | "impaye" | "annule"
): Promise<void> {
  const update: Record<string, unknown> = { plan: planId, plan_status: status };
  if (subscription?.id) update.stripe_subscription_id = subscription.id;
  if (subscription?.customer) update.stripe_customer_id = subscription.customer;
  if (subscription?.current_period_end) {
    update.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }

  const { error } = await nidService()
    .from("nid_workspaces")
    .update(update)
    .eq("id", workspaceId);
  if (error) throw new Error(error.message);

  await recordNidAudit({
    actorRole: "systeme",
    action: "billing.plan_updated",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { plan: planId, status },
  });
}

/** Offre gratuite correspondant au type d'espace (retour après annulation). */
async function fallbackPlan(workspaceId: string): Promise<NidPlanId> {
  const { data } = await nidService()
    .from("nid_workspaces")
    .select("kind")
    .eq("id", workspaceId)
    .maybeSingle();
  const kind = (data as { kind: string } | null)?.kind;
  if (kind === "atelier") return "atelier_contributeur";
  if (kind === "entreprise") return "entreprise_starter";
  return "perso_gratuit";
}

export interface WebhookOutcome {
  handled: boolean;
  reason: string;
}

/**
 * Traite un événement Stripe Nireo ID.
 * Un plan payant n'est activé QUE si l'abonnement est réellement actif
 * (`active` ou `trialing`) — jamais sur un simple événement de session.
 */
export async function handleNidStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  if (!isNireoIdConfigured) return { handled: false, reason: "nireo_id_non_configure" };
  if (await alreadyProcessed(event.id)) {
    return { handled: false, reason: "deja_traite" };
  }

  const stripe = getStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.product !== "nireo-id") {
          return { handled: false, reason: "autre_produit" };
        }
        const workspaceId = session.metadata?.workspace_id ?? session.client_reference_id;
        if (!workspaceId || typeof session.subscription !== "string") {
          return { handled: false, reason: "donnees_incompletes" };
        }

        // Le paiement est revérifié auprès de Stripe : l'événement seul ne
        // suffit jamais à débloquer une offre payante.
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const planId = nidPlanFromPriceId(priceId);
        if (!planId) return { handled: false, reason: "price_inconnu" };
        if (subscription.status !== "active" && subscription.status !== "trialing") {
          return { handled: false, reason: "abonnement_non_actif" };
        }

        await applyPlan(
          workspaceId,
          planId,
          {
            id: subscription.id,
            customer: typeof subscription.customer === "string" ? subscription.customer : undefined,
            current_period_end: (subscription as unknown as { current_period_end?: number })
              .current_period_end,
          },
          "actif"
        );
        await markProcessed(event.id, event.type, workspaceId);
        return { handled: true, reason: "plan_active" };
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.metadata?.product !== "nireo-id") {
          return { handled: false, reason: "autre_produit" };
        }
        const workspaceId = subscription.metadata?.workspace_id;
        if (!workspaceId) return { handled: false, reason: "espace_inconnu" };

        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const planId = nidPlanFromPriceId(priceId);

        if (
          event.type === "customer.subscription.deleted" ||
          subscription.status === "canceled" ||
          subscription.status === "unpaid" ||
          subscription.status === "incomplete_expired"
        ) {
          const free = await fallbackPlan(workspaceId);
          await applyPlan(workspaceId, free, null, "annule");
          await markProcessed(event.id, event.type, workspaceId);
          return { handled: true, reason: "retour_offre_gratuite" };
        }

        if (subscription.status === "past_due") {
          const { error } = await nidService()
            .from("nid_workspaces")
            .update({ plan_status: "impaye" })
            .eq("id", workspaceId);
          if (error) throw new Error(error.message);
          await markProcessed(event.id, event.type, workspaceId);
          return { handled: true, reason: "impaye" };
        }

        if (planId && (subscription.status === "active" || subscription.status === "trialing")) {
          await applyPlan(
            workspaceId,
            planId,
            {
              id: subscription.id,
              customer:
                typeof subscription.customer === "string" ? subscription.customer : undefined,
              current_period_end: (subscription as unknown as { current_period_end?: number })
                .current_period_end,
            },
            "actif"
          );
          await markProcessed(event.id, event.type, workspaceId);
          return { handled: true, reason: "plan_mis_a_jour" };
        }

        return { handled: false, reason: "statut_ignore" };
      }

      default:
        return { handled: false, reason: "type_ignore" };
    }
  } catch (error) {
    logger.error("nireo-id/billing webhook", error);
    throw error;
  }
}
