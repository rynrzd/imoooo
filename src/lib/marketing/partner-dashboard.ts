import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Statistiques d'UN partenaire pour son tableau de bord self-service.
 * Sources réelles (clics, attributions, commissions encaissées) — aucune
 * valeur simulée. Toutes les lectures passent par la clé secrète serveur.
 */

export interface PartnerDashboardStats {
  clicks: number;
  signups: number;
  /** Inscriptions devenues clients payants (= abonnements générés). */
  conversions: number;
  /** CA TTC réellement encaissé attribué au partenaire (centimes). */
  grossRevenueCents: number;
  /** Commissions gagnées = toutes hors annulées/remboursées (centimes). */
  earnedCents: number;
  /** Commissions déjà payées (centimes). */
  paidCents: number;
  /** Commissions restant à payer = gagnées − payées (centimes). */
  remainingCents: number;
}

export interface PartnerCommissionRow {
  earnedAt: string;
  plan: string;
  grossCents: number;
  commissionCents: number;
  status: string;
}

const LIVE_STATUSES = new Set(["pending", "approved", "payable", "paid"]);

/** Agrège clics / inscriptions / conversions / commissions du partenaire. */
export async function getPartnerDashboardStats(
  partnerId: string
): Promise<PartnerDashboardStats> {
  const admin = createAdminClient();
  const [clicks, signups, conversions, commissions] = await Promise.all([
    admin.from("partner_clicks").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    admin
      .from("partner_attributions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId),
    admin
      .from("partner_attributions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .eq("status", "converted"),
    admin
      .from("partner_commissions")
      .select("status, gross_amount, commission_amount")
      .eq("partner_id", partnerId)
      .limit(100000),
  ]);

  for (const r of [clicks, signups, conversions]) {
    if (r.error) throw new Error(`Lecture des statistiques impossible : ${r.error.message}`);
  }
  if (commissions.error) {
    throw new Error(`Lecture des commissions impossible : ${commissions.error.message}`);
  }

  let grossRevenueCents = 0;
  let earnedCents = 0;
  let paidCents = 0;
  for (const row of commissions.data ?? []) {
    const status = row.status as string;
    const amount = (row.commission_amount as number) ?? 0;
    if (!LIVE_STATUSES.has(status)) continue; // annulées / remboursées exclues
    grossRevenueCents += (row.gross_amount as number) ?? 0;
    earnedCents += amount;
    if (status === "paid") paidCents += amount;
  }

  return {
    clicks: clicks.count ?? 0,
    signups: signups.count ?? 0,
    conversions: conversions.count ?? 0,
    grossRevenueCents,
    earnedCents,
    paidCents,
    remainingCents: earnedCents - paidCents,
  };
}

/** Dernières commissions du partenaire (historique, plus récentes d'abord). */
export async function getPartnerCommissions(
  partnerId: string,
  limit = 20
): Promise<PartnerCommissionRow[]> {
  const { data, error } = await createAdminClient()
    .from("partner_commissions")
    .select("earned_at, plan, gross_amount, commission_amount, status")
    .eq("partner_id", partnerId)
    .order("earned_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture des commissions impossible : ${error.message}`);
  return (data ?? []).map((row) => ({
    earnedAt: row.earned_at as string,
    plan: (row.plan as string) ?? "",
    grossCents: (row.gross_amount as number) ?? 0,
    commissionCents: (row.commission_amount as number) ?? 0,
    status: (row.status as string) ?? "pending",
  }));
}
