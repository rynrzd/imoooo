import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerPayoutRow } from "./types";

/**
 * Relevés de paiement partenaires — SERVEUR uniquement.
 * v1 : les virements sont faits MANUELLEMENT par l'admin ; Nireo ne
 * déclenche aucun virement bancaire. L'admin crée le relevé, fait le
 * virement, puis marque le relevé « payé » (fonction SQL atomique,
 * anti double paiement).
 */

export async function getPayout(id: string): Promise<PartnerPayoutRow | null> {
  const { data, error } = await createAdminClient()
    .from("partner_payouts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Lecture du relevé impossible : ${error.message}`);
  return (data as PartnerPayoutRow | null) ?? null;
}

/**
 * Crée un relevé (draft) pour un partenaire et une période : rattache
 * les commissions PAYABLES non déjà liées à un relevé, et enregistre le
 * total calculé côté serveur (jamais fourni par le navigateur).
 */
export async function createPayout(input: {
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
  createdBy: string | null;
}): Promise<{ payout: PartnerPayoutRow; commissionsCount: number }> {
  const admin = createAdminClient();

  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Période invalide.");
  }
  // Fin de période inclusive (journée entière).
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const { data: commissions, error: commissionsError } = await admin
    .from("partner_commissions")
    .select("id, commission_amount, currency")
    .eq("partner_id", input.partnerId)
    .eq("status", "payable")
    .is("payout_id", null)
    .gte("earned_at", start.toISOString())
    .lt("earned_at", endExclusive.toISOString());
  if (commissionsError) {
    throw new Error(`Lecture des commissions payables impossible : ${commissionsError.message}`);
  }
  if (!commissions || commissions.length === 0) {
    throw new Error("Aucune commission disponible sur cette période pour ce partenaire.");
  }

  const totalCents = commissions.reduce((sum, c) => sum + (c.commission_amount ?? 0), 0);
  const currency = (commissions[0]?.currency as string) ?? "eur";

  const { data: payout, error: payoutError } = await admin
    .from("partner_payouts")
    .insert({
      partner_id: input.partnerId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      total_amount: totalCents,
      currency,
      status: "draft",
      notes: input.notes.slice(0, 1000),
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (payoutError) throw new Error(`Création du relevé impossible : ${payoutError.message}`);

  const { error: linkError } = await admin
    .from("partner_commissions")
    .update({ payout_id: (payout as PartnerPayoutRow).id })
    .in(
      "id",
      commissions.map((c) => c.id as string)
    )
    .eq("status", "payable")
    .is("payout_id", null);
  if (linkError) {
    // Nettoyage : un relevé sans commissions liées ne doit pas rester.
    await admin.from("partner_payouts").delete().eq("id", (payout as PartnerPayoutRow).id);
    throw new Error(`Rattachement des commissions impossible : ${linkError.message}`);
  }

  return { payout: payout as PartnerPayoutRow, commissionsCount: commissions.length };
}

/** draft → approved (relevé vérifié, prêt pour le virement). */
export async function approvePayout(id: string): Promise<PartnerPayoutRow> {
  const payout = await getPayout(id);
  if (!payout) throw new Error("Relevé introuvable.");
  if (payout.status !== "draft") {
    throw new Error("Seul un relevé brouillon peut être approuvé.");
  }
  const { data, error } = await createAdminClient()
    .from("partner_payouts")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw new Error(`Approbation impossible : ${error.message}`);
  return data as PartnerPayoutRow;
}

/**
 * Marque le relevé « payé » APRÈS le virement manuel — fonction SQL
 * atomique : relevé + commissions basculent ensemble, un relevé déjà
 * payé est refusé (anti double paiement).
 */
export async function markPayoutPaid(input: {
  payoutId: string;
  paymentMethod: string;
  paymentReference: string;
  notes: string;
}): Promise<{ totalCents: number; count: number }> {
  const method = input.paymentMethod.trim();
  if (!method) throw new Error("La méthode de paiement est obligatoire (ex. « Virement SEPA »).");

  const { data, error } = await createAdminClient().rpc("mark_partner_payout_paid", {
    p_payout_id: input.payoutId,
    p_payment_method: method,
    p_payment_reference: input.paymentReference.trim(),
    p_notes: input.notes.trim(),
  });
  if (error) throw new Error(`Marquage payé impossible : ${error.message}`);
  const result = data as { ok: boolean; reason?: string; total_cents?: number; count?: number };
  if (!result.ok) {
    const reasons: Record<string, string> = {
      not_found: "Relevé introuvable.",
      already_paid: "Ce relevé est DÉJÀ payé : double paiement bloqué.",
      cancelled: "Ce relevé est annulé.",
      no_commissions: "Aucune commission payable liée à ce relevé.",
    };
    throw new Error(reasons[result.reason ?? ""] ?? "Marquage payé impossible.");
  }
  return { totalCents: result.total_cents ?? 0, count: result.count ?? 0 };
}

/** Annule un relevé NON payé : ses commissions redeviennent disponibles. */
export async function cancelPayout(id: string): Promise<void> {
  const { data, error } = await createAdminClient().rpc("cancel_partner_payout", {
    p_payout_id: id,
  });
  if (error) throw new Error(`Annulation impossible : ${error.message}`);
  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    const reasons: Record<string, string> = {
      not_found: "Relevé introuvable.",
      already_paid: "Un relevé déjà payé ne peut pas être annulé.",
      cancelled: "Ce relevé est déjà annulé.",
    };
    throw new Error(reasons[result.reason ?? ""] ?? "Annulation impossible.");
  }
}
