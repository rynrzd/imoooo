import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";
import {
  createCommissionForPaidInvoice,
  reverseCommissionForRefund,
} from "@/lib/marketing/commissions";
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
    const { data: insertedRedemption, error } = await admin
      .from("promo_code_redemptions")
      .upsert(
        {
          promo_code_id: promo.id,
          user_id: userId,
          user_email: session.customer_details?.email ?? "",
          amount_total_cents: session.amount_total,
          // Réduction EXACTE appliquée par Stripe (statistiques fiables).
          discount_cents: session.total_details?.amount_discount ?? null,
          stripe_checkout_session_id: session.id,
        },
        { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true }
      )
      .select("id");
    if (error) throw new Error(error.message);
    // Compteur incrémenté UNIQUEMENT si la rédemption vient d'être créée :
    // jamais sur un webhook rejoué / une session déjà comptabilisée.
    if (insertedRedemption && insertedRedemption.length > 0) {
      await admin
        .from("promo_codes")
        .update({ times_redeemed: (promo.times_redeemed ?? 0) + 1 })
        .eq("id", promo.id);
    }
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
 * - charge.refunded          (commissions partenaires : reversal)
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

  // Idempotence : on « réserve » l'événement par son id AVANT tout
  // traitement. Un événement déjà traité (rejeu / doublon Stripe) est ignoré
  // sans effet de bord. Dégradation gracieuse : si la table n'existe pas
  // encore (migration non appliquée), on journalise et on poursuit — les
  // handlers restent individuellement idempotents.
  const idem = createAdminClient();
  let claimed = false;
  {
    const { error: claimError } = await idem
      .from("stripe_webhook_events")
      .insert({ id: event.id, type: event.type });
    if (claimError) {
      if (claimError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      logger.error("[stripe/webhook] réservation idempotence", claimError);
    } else {
      claimed = true;
    }
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
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null);
          const admin = createAdminClient();
          const { error } = await admin.rpc("confirm_founder_purchase", {
            p_user_id: userId,
            p_session_id: session.id,
            p_payment_intent: paymentIntentId,
            p_amount_cents: session.amount_total ?? 0,
            p_currency: session.currency ?? "eur",
          });
          if (error) {
            // Course sur la dernière place : le paiement est encaissé mais les
            // 100 places sont prises. On REMBOURSE automatiquement (jamais de
            // client débité sans place) puis on clôt l'événement — sinon Stripe
            // rejouerait indéfiniment un échec impossible à résoudre.
            const soldOut =
              error.code === "P0001" || (error.message ?? "").includes("founder_sold_out");
            if (soldOut) {
              if (paymentIntentId) {
                try {
                  await stripe.refunds.create({
                    payment_intent: paymentIntentId,
                    reason: "requested_by_customer",
                    metadata: { immopilot_founder_sold_out: "1", user_id: userId },
                  });
                } catch (refundErr) {
                  // Déjà remboursé (rejeu) : on poursuit. Sinon on relaie pour
                  // que Stripe retente le remboursement.
                  const code = (refundErr as { code?: string })?.code;
                  if (code !== "charge_already_refunded") throw refundErr;
                }
              }
              await admin
                .from("founder_purchases")
                .update({ status: "canceled" })
                .eq("stripe_checkout_session_id", session.id);
              logger.error(
                "[stripe/webhook] Fondateur épuisé après paiement — remboursement émis",
                `session=${session.id} user=${userId} pi=${paymentIntentId ?? "?"}`
              );
              break;
            }
            throw new Error(`Confirmation Fondateur impossible : ${error.message}`);
          }
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

        // Commission partenaire : UNIQUEMENT sur un paiement réellement
        // encaissé (invoice.paid, montant > 0). Idempotent (facture unique
        // en base) et jamais bloquant pour la synchronisation.
        if (event.type === "invoice.paid") {
          await createCommissionForPaidInvoice(stripe, invoice, subscription, userId);
        }
        break;
      }

      // Remboursement (total ou partiel) : la commission partenaire liée
      // au paiement est inversée ou recalculée. Jamais bloquant.
      case "charge.refunded": {
        await reverseCommissionForRefund(event.data.object);
        break;
      }

      default:
        // Événement non géré : accusé de réception sans action.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    logger.error(`[stripe/webhook] ${event.type}`, e);
    // Le traitement a échoué : on LIBÈRE la réservation pour que la reprise
    // Stripe puisse rejouer l'événement (les handlers sont idempotents).
    if (claimed) {
      const { error: releaseError } = await idem
        .from("stripe_webhook_events")
        .delete()
        .eq("id", event.id);
      if (releaseError) logger.error("[stripe/webhook] libération idempotence", releaseError);
    }
    // 500 → Stripe retentera automatiquement la livraison.
    return NextResponse.json({ error: "Traitement du webhook impossible." }, { status: 500 });
  }
}
