import type Stripe from "stripe";
import { logger } from "@/lib/logger";
import { planFromPriceId } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MarketingPartnerRow,
  PartnerAttributionRow,
  PartnerCommissionRow,
} from "./types";

/**
 * Commissions partenaires — créées UNIQUEMENT depuis le webhook Stripe,
 * après un paiement réellement confirmé (invoice.paid, amount_paid > 0).
 *
 * Idempotence : stripe_invoice_id est UNIQUE en base → un événement
 * Stripe rejoué (ou dupliqué) ne crée JAMAIS deux commissions.
 *
 * Jamais de commission sur : clic, inscription, redirection Checkout,
 * paiement échoué, facture à 0 € (période gratuite/essai), transaction
 * remboursée (reversal via charge.refunded), partenaire inactif/expiré,
 * plan non couvert, commission non configurée (valeur 0).
 */

/** Statuts « vivants » : comptent pour les règles premier paiement / fixe. */
const LIVE_STATUSES = ["pending", "approved", "payable", "paid"];

interface EligibilityContext {
  partner: MarketingPartnerRow;
  attribution: PartnerAttributionRow;
}

/** Attribution + partenaire actifs pour un utilisateur (null si aucun droit). */
async function getEligibilityContext(userId: string): Promise<EligibilityContext | null> {
  const admin = createAdminClient();
  const { data: attribution, error } = await admin
    .from("partner_attributions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture de l'attribution impossible : ${error.message}`);
  if (!attribution) return null;

  const { data: partner, error: partnerError } = await admin
    .from("marketing_partners")
    .select("*")
    .eq("id", attribution.partner_id)
    .maybeSingle();
  if (partnerError) throw new Error(`Lecture du partenaire impossible : ${partnerError.message}`);
  if (!partner) return null;

  const p = partner as MarketingPartnerRow;
  const now = Date.now();
  if (!p.is_active) return null;
  if (p.starts_at && now < new Date(p.starts_at).getTime()) return null;
  if (p.expires_at && now > new Date(p.expires_at).getTime()) return null;

  return { partner: p, attribution: attribution as PartnerAttributionRow };
}

/** Somme des taxes SÉPARÉES (exclusives) d'une facture, en centimes. */
function exclusiveTaxCents(invoice: Stripe.Invoice): number {
  return (invoice.total_taxes ?? [])
    .filter((tax) => tax.tax_behavior === "exclusive")
    .reduce((sum, tax) => sum + (tax.amount ?? 0), 0);
}

/** PaymentIntent réellement associé au paiement de la facture (best-effort). */
async function findPaymentIntentId(stripe: Stripe, invoiceId: string): Promise<string> {
  try {
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 3 });
    for (const payment of payments.data) {
      if (payment.status !== "paid") continue;
      const pi = payment.payment.payment_intent;
      if (typeof pi === "string") return pi;
      if (pi?.id) return pi.id;
    }
  } catch (e) {
    logger.error("[marketing/commissions] lecture payment_intent", e);
  }
  return "";
}

/**
 * Crée la commission d'une facture PAYÉE si toutes les règles l'autorisent.
 * Appelée par le webhook après `invoice.paid`. Ne lève jamais : un échec
 * de commission ne doit pas faire échouer la synchronisation d'abonnement
 * (Stripe rejouerait l'événement complet).
 */
export async function createCommissionForPaidInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  userId: string
): Promise<void> {
  try {
    // Paiement réellement encaissé uniquement.
    if (invoice.status !== "paid") {
      logger.info("diag/marketing", `commission ignorée · invoice ${invoice.id} status=${invoice.status} (≠ paid)`);
      return;
    }
    const grossCents = invoice.amount_paid ?? 0;
    if (grossCents <= 0) {
      logger.info("diag/marketing", `commission ignorée · invoice ${invoice.id} amount_paid=${grossCents}c (essai/0€)`);
      return; // facture à 0 € : essai, période gratuite…
    }

    const context = await getEligibilityContext(userId);
    if (!context) {
      logger.info("diag/marketing", `commission ignorée · user ${userId} : aucune attribution partenaire active`);
      return;
    }
    const { partner, attribution } = context;
    logger.info("diag/marketing", `partenaire détecté · partner=${partner.id} type=${partner.commission_type} valeur=${partner.commission_value} user=${userId}`);

    // Aucune règle appliquée sans configuration explicite.
    if (!(partner.commission_value > 0)) {
      logger.info("diag/marketing", `commission ignorée · partner ${partner.id} commission_value=0`);
      return;
    }

    // Plan couvert par l'accord (vide = tous les plans payants).
    const priceId = subscription.items.data[0]?.price.id ?? "";
    const plan = priceId ? (planFromPriceId(priceId) ?? "") : "";
    if (partner.applicable_plans.length > 0 && !partner.applicable_plans.includes(plan)) {
      return;
    }

    const admin = createAdminClient();

    // Règles de durée : premier paiement / N mois / à vie / fixe (1 fois).
    if (
      partner.commission_type === "fixed" ||
      partner.commission_duration_type === "first_payment"
    ) {
      const { count, error } = await admin
        .from("partner_commissions")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partner.id)
        .eq("user_id", userId)
        .in("status", LIVE_STATUSES);
      if (error) throw new Error(error.message);
      if ((count ?? 0) > 0) return; // déjà commissionné pour ce client
    } else if (partner.commission_duration_type === "months") {
      const months = partner.commission_duration_months ?? 0;
      if (months <= 0) return;
      const start = attribution.converted_at ? new Date(attribution.converted_at) : new Date();
      const limit = new Date(start);
      limit.setMonth(limit.getMonth() + months);
      if (new Date() > limit) return; // fenêtre de commission écoulée
    }
    // 'lifetime' : tant que l'abonnement paie, la commission court.

    // Assiette : encaissé TTC moins taxes séparées (exclusives).
    const eligibleCents = Math.max(0, grossCents - exclusiveTaxCents(invoice));
    if (eligibleCents <= 0) return;

    const commissionCents =
      partner.commission_type === "fixed"
        ? Math.round(partner.commission_value * 100)
        : Math.round((eligibleCents * partner.commission_value) / 100);
    if (commissionCents <= 0) return;
    logger.info(
      "diag/marketing",
      `commission calculée · gross=${grossCents}c eligible=${eligibleCents}c taux=${partner.commission_value} → commission=${commissionCents}c (partner=${partner.id})`
    );

    const paymentIntentId = await findPaymentIntentId(stripe, invoice.id!);

    // Insertion idempotente : stripe_invoice_id unique. Un doublon
    // (webhook rejoué) est ignoré sans erreur ni effet de bord.
    const { data: inserted, error: insertError } = await admin
      .from("partner_commissions")
      .upsert(
        {
          partner_id: partner.id,
          user_id: userId,
          subscription_id: subscription.id,
          stripe_invoice_id: invoice.id!,
          stripe_payment_intent_id: paymentIntentId,
          plan,
          gross_amount: grossCents,
          eligible_amount: eligibleCents,
          commission_type: partner.commission_type,
          commission_rate: partner.commission_value,
          commission_amount: commissionCents,
          currency: invoice.currency ?? "eur",
          status: "pending",
          earned_at: new Date().toISOString(),
        },
        { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
      )
      .select("id");
    if (insertError) throw new Error(insertError.message);
    if (!inserted || inserted.length === 0) {
      logger.info("diag/marketing", `commission NON ré-enregistrée · invoice ${invoice.id} déjà commissionnée (idempotence)`);
      return; // doublon ignoré
    }
    logger.info(
      "diag/marketing",
      `commission ENREGISTRÉE · id=${inserted[0].id} montant=${commissionCents}c invoice=${invoice.id} partner=${partner.id}`
    );

    // Première conversion : l'attribution passe à « converted ».
    if (!attribution.converted_at) {
      const { error: convertError } = await admin
        .from("partner_attributions")
        .update({ status: "converted", converted_at: new Date().toISOString() })
        .eq("id", attribution.id)
        .is("converted_at", null);
      if (convertError) throw new Error(convertError.message);
    }
  } catch (e) {
    logger.error("[marketing/commissions] création de commission", e);
  }
}

/**
 * Remboursement Stripe (charge.refunded) : la commission liée au
 * paiement est inversée (totale) ou recalculée (partielle, si percent
 * et non payée). Une commission déjà payée passe « reversed » avec une
 * raison explicite — l'admin la déduit du prochain relevé.
 */
export async function reverseCommissionForRefund(charge: Stripe.Charge): Promise<void> {
  try {
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? "");
    if (!paymentIntentId) return;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_commissions")
      .select("*")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .in("status", LIVE_STATUSES);
    if (error) throw new Error(error.message);
    const commissions = (data ?? []) as PartnerCommissionRow[];
    if (commissions.length === 0) return;

    const fullyRefunded = charge.refunded || charge.amount_refunded >= charge.amount;

    for (const commission of commissions) {
      if (fullyRefunded || commission.status === "paid" || commission.commission_type === "fixed") {
        const reason =
          commission.status === "paid"
            ? "Paiement remboursé côté Stripe après versement — à déduire du prochain relevé."
            : "Paiement remboursé côté Stripe.";
        const { error: updateError } = await admin
          .from("partner_commissions")
          .update({ status: "reversed", reversal_reason: reason })
          .eq("id", commission.id);
        if (updateError) throw new Error(updateError.message);
        continue;
      }
      // Remboursement PARTIEL d'une commission % non payée : recalcul
      // proportionnel sur le montant réellement conservé.
      const newEligible = Math.max(0, commission.eligible_amount - charge.amount_refunded);
      if (newEligible <= 0) {
        const { error: updateError } = await admin
          .from("partner_commissions")
          .update({ status: "reversed", reversal_reason: "Paiement intégralement remboursé." })
          .eq("id", commission.id);
        if (updateError) throw new Error(updateError.message);
        continue;
      }
      const newAmount = Math.round((newEligible * commission.commission_rate) / 100);
      const { error: updateError } = await admin
        .from("partner_commissions")
        .update({
          eligible_amount: newEligible,
          commission_amount: newAmount,
          reversal_reason: `Remboursement partiel Stripe (${(charge.amount_refunded / 100).toFixed(2)} €) — commission recalculée.`,
        })
        .eq("id", commission.id);
      if (updateError) throw new Error(updateError.message);
    }
  } catch (e) {
    logger.error("[marketing/commissions] reversal remboursement", e);
  }
}

/* ------------------------------------------------------------------ */
/* Actions admin (appelées par les routes API sécurisées)              */
/* ------------------------------------------------------------------ */

export async function getCommission(id: string): Promise<PartnerCommissionRow | null> {
  const { data, error } = await createAdminClient()
    .from("partner_commissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la commission impossible : ${error.message}`);
  return (data as PartnerCommissionRow | null) ?? null;
}

/** pending → approved. */
export async function approveCommission(id: string): Promise<PartnerCommissionRow> {
  const commission = await getCommission(id);
  if (!commission) throw new Error("Commission introuvable.");
  if (commission.status !== "pending") {
    throw new Error("Seule une commission « en attente » peut être validée.");
  }
  const { data, error } = await createAdminClient()
    .from("partner_commissions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw new Error(`Validation impossible : ${error.message}`);
  return data as PartnerCommissionRow;
}

/** approved → payable (disponible pour un relevé de paiement). */
export async function makeCommissionPayable(id: string): Promise<PartnerCommissionRow> {
  const commission = await getCommission(id);
  if (!commission) throw new Error("Commission introuvable.");
  if (commission.status !== "approved") {
    throw new Error("Seule une commission « validée » peut devenir disponible.");
  }
  const { data, error } = await createAdminClient()
    .from("partner_commissions")
    .update({ status: "payable", payable_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved")
    .select("*")
    .single();
  if (error) throw new Error(`Passage en disponible impossible : ${error.message}`);
  return data as PartnerCommissionRow;
}

/** Annulation admin avec raison obligatoire (jamais sur une payée). */
export async function cancelCommission(id: string, reason: string): Promise<PartnerCommissionRow> {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("Une raison d'annulation est obligatoire.");
  const commission = await getCommission(id);
  if (!commission) throw new Error("Commission introuvable.");
  if (commission.status === "paid") {
    throw new Error("Une commission déjà payée ne peut pas être annulée.");
  }
  if (commission.status === "cancelled" || commission.status === "reversed") {
    throw new Error("Cette commission est déjà annulée ou remboursée.");
  }
  const { data, error } = await createAdminClient()
    .from("partner_commissions")
    .update({
      status: "cancelled",
      reversal_reason: cleanReason.slice(0, 500),
      payout_id: null,
    })
    .eq("id", id)
    .in("status", ["pending", "approved", "payable"])
    .select("*")
    .single();
  if (error) throw new Error(`Annulation impossible : ${error.message}`);
  return data as PartnerCommissionRow;
}
