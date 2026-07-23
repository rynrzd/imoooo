import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";
import { getStripeWebhookSecret, isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { syncSubscriptionToDatabase } from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Enregistre l'utilisation d'un code promo (table promo_code_redemptions)
 * quand la session Checkout portait un promotion code géré par l'admin.
 * Best-effort : ne fait JAMAIS échouer le traitement du webhook.
 */
async function recordPromoRedemption(
  session: Stripe.Checkout.Session,
  userId: string
): Promise<void> {
  try {
    const promotionCodeId = session.discounts?.[0]?.promotion_code;
    const id = typeof promotionCodeId === "string" ? promotionCodeId : promotionCodeId?.id;
    if (!id) return;
    const admin = createAdminClient();
    const { data: promo } = await admin
      .from("promo_codes")
      .select("id, times_redeemed")
      .eq("stripe_promotion_code_id", id)
      .maybeSingle();
    if (!promo) return;
    const { error } = await admin.from("promo_code_redemptions").upsert(
      {
        promo_code_id: promo.id,
        user_id: userId,
        user_email: session.customer_details?.email ?? "",
        amount_total_cents: session.amount_total,
        stripe_checkout_session_id: session.id,
      },
      { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true }
    );
    if (error) throw new Error(error.message);
    await admin
      .from("promo_codes")
      .update({ times_redeemed: (promo.times_redeemed ?? 0) + 1 })
      .eq("id", promo.id);
  } catch (e) {
    logger.error("[stripe/webhook] suivi code promo", e);
  }
}

/**
 * POST /api/stripe/webhook — endpoint appelé par Stripe (jamais par un
 * utilisateur). Authentification par signature (STRIPE_WEBHOOK_SECRET).
 *
 * Événements à cocher lors de la création du webhook dans le Dashboard :
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */
export async function POST(request: Request) {
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature absente." }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    // Corps BRUT requis : toute reformulation invaliderait la signature.
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (e) {
    logger.error("[stripe/webhook] signature invalide", e);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Paiement UNIQUE Fondateur : place attribuée ici, atomiquement,
        // uniquement si le paiement est réellement encaissé. Idempotent :
        // un webhook rejoué renvoie le même numéro (fonction SQL).
        if (session.mode === "payment" && session.metadata?.immopilot_founder === "1") {
          if (session.payment_status !== "paid") break; // rien sans paiement confirmé
          const userId = session.client_reference_id ?? session.metadata.user_id;
          if (!userId) {
            throw new Error(`Session Fondateur ${session.id} sans user_id.`);
          }
          const admin = createAdminClient();
          const { error } = await admin.rpc("confirm_founder_purchase", {
            p_user_id: userId,
            p_session_id: session.id,
            p_payment_intent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
            p_amount_cents: session.amount_total ?? 0,
            p_currency: session.currency ?? "eur",
          });
          if (error) throw new Error(`Confirmation Fondateur impossible : ${error.message}`);
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id
        );
        const userId = session.client_reference_id ?? subscription.metadata.user_id;
        if (!userId) {
          throw new Error(`Session ${session.id} sans user_id (client_reference_id).`);
        }
        await syncSubscriptionToDatabase(createAdminClient(), userId, subscription);
        await recordPromoRedemption(session, userId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata.user_id;
        if (!userId) {
          throw new Error(`Abonnement ${subscription.id} sans metadata.user_id.`);
        }
        await syncSubscriptionToDatabase(createAdminClient(), userId, subscription);
        break;
      }

      // Paiement de facture (réussi ou échoué) : on resynchronise l'abonnement
      // depuis Stripe — le statut (active, past_due…) fait foi côté serveur.
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const ref = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof ref === "string" ? ref : ref?.id;
        if (!subscriptionId) break; // facture hors abonnement (ex. paiement unique)
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.user_id;
        if (!userId) {
          throw new Error(`Abonnement ${subscription.id} sans metadata.user_id.`);
        }
        await syncSubscriptionToDatabase(createAdminClient(), userId, subscription);
        break;
      }

      default:
        // Événement non géré : accusé de réception sans action.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    logger.error(`[stripe/webhook] ${event.type}`, e);
    // 500 → Stripe retentera automatiquement la livraison.
    return NextResponse.json({ error: "Traitement du webhook impossible." }, { status: 500 });
  }
}
