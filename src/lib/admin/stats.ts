import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaidPlanId } from "@/config/plans";

/**
 * Statistiques du tableau de bord administrateur — données RÉELLES
 * (Supabase + Stripe), aucune donnée fictive. Les comptes administrateurs
 * sont exclus de toutes les statistiques clients : un admin n'est pas un
 * client Nireo.
 */

const ACTIVE_OR = "lifetime_access.is.true,status.in.(active,trialing,past_due)";
const PAID_PLANS: PaidPlanId[] = ["starter", "pro", "business"];

export interface RecentAccount {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  created_at: string;
}

export interface RecentSubscription {
  user_id: string;
  email: string;
  plan: string;
  status: string;
  provider: string;
  updated_at: string;
}

export interface AuditRow {
  id: string;
  admin_email: string;
  action: string;
  target_label: string;
  result: string;
  detail: string;
  created_at: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers30: number | null;
  newUsers7: number;
  newUsers30: number;
  freeUsers: number;
  planCounts: Record<PaidPlanId, number>;
  founderMembers: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  /** Encaissements du mois en cours, en centimes (null : Stripe absent). */
  monthlyRevenueCents: number | null;
  promoRedemptions: number;
  recentAccounts: RecentAccount[];
  recentSubscriptions: RecentSubscription[];
  recentErrors: AuditRow[];
  recentActivity: AuditRow[];
}

/** user_id de tous les administrateurs (exclus des statistiques clients). */
export async function getAdminUserIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("admin_users").select("user_id");
  if (error) throw new Error(`Lecture des administrateurs impossible : ${error.message}`);
  return (data ?? []).map((r) => r.user_id as string);
}

/** Filtre PostgREST « id hors administrateurs » (no-op sans admins). */
function excludeIds(ids: string[]): string | null {
  return ids.length > 0 ? `(${ids.join(",")})` : null;
}

async function count(
  build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count: value, error } = await build();
  if (error) throw new Error(error.message);
  return value ?? 0;
}

/** Utilisateurs actifs = dernière connexion < 30 jours (API admin Auth). */
async function countActiveUsers30(admin: SupabaseClient, adminIds: string[]): Promise<number | null> {
  try {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const excluded = new Set(adminIds);
    let active = 0;
    // Parcours paginé plafonné (10 000 comptes) — suffisant pour la bêta.
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        if (excluded.has(u.id)) continue;
        if (u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= cutoff) active++;
      }
      if (data.users.length < 1000) break;
    }
    return active;
  } catch (e) {
    logger.error("admin/stats", e);
    return null;
  }
}

/** Encaissements Stripe du mois (factures payées + achats Fondateur). */
async function monthlyRevenue(admin: SupabaseClient): Promise<number | null> {
  if (!isStripeConfigured) return null;
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const stripe = getStripe();
    let total = 0;
    // Factures d'abonnement payées ce mois-ci (plafonné à 300 factures).
    let startingAfter: string | undefined;
    for (let i = 0; i < 3; i++) {
      const invoices = await stripe.invoices.list({
        status: "paid",
        created: { gte: Math.floor(monthStart.getTime() / 1000) },
        limit: 100,
        starting_after: startingAfter,
      });
      for (const invoice of invoices.data) total += invoice.amount_paid;
      if (!invoices.has_more) break;
      startingAfter = invoices.data[invoices.data.length - 1]?.id;
    }
    // Paiements uniques Fondateur confirmés ce mois-ci (déjà en base).
    const { data, error } = await admin
      .from("founder_purchases")
      .select("amount_cents")
      .eq("status", "confirmed")
      .gte("confirmed_at", monthStart.toISOString());
    if (error) throw new Error(error.message);
    for (const row of data ?? []) total += row.amount_cents ?? 0;
    return total;
  } catch (e) {
    logger.error("admin/stats", e);
    return null;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const admin = createAdminClient();
  const adminIds = await getAdminUserIds(admin);
  const excluded = excludeIds(adminIds);

  const profilesBase = () => {
    let query = admin.from("profiles").select("id", { count: "exact", head: true });
    if (excluded) query = query.not("id", "in", excluded);
    return query;
  };
  const subsBase = () => {
    let query = admin.from("subscriptions").select("id", { count: "exact", head: true });
    if (excluded) query = query.not("user_id", "in", excluded);
    return query;
  };

  const now = Date.now();
  const iso7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const iso30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

  const [
    totalUsers,
    newUsers7,
    newUsers30,
    starter,
    pro,
    business,
    activeSubscriptions,
    canceledSubscriptions,
    pastDueSubscriptions,
    founderMembers,
    activeUsers30,
    monthlyRevenueCents,
  ] = await Promise.all([
    count(() => profilesBase()),
    count(() => profilesBase().gte("created_at", iso7)),
    count(() => profilesBase().gte("created_at", iso30)),
    count(() => subsBase().eq("plan", "starter").or(ACTIVE_OR)),
    count(() => subsBase().eq("plan", "pro").or(ACTIVE_OR)),
    count(() => subsBase().eq("plan", "business").or(ACTIVE_OR)),
    count(() => subsBase().in("plan", PAID_PLANS).or(ACTIVE_OR)),
    count(() => subsBase().eq("status", "canceled")),
    count(() => subsBase().eq("status", "past_due")),
    count(() =>
      admin
        .from("founder_purchases")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
    ),
    countActiveUsers30(admin, adminIds),
    monthlyRevenue(admin),
  ]);

  // Codes promo : total des utilisations enregistrées.
  const { data: promoRows, error: promoError } = await admin
    .from("promo_codes")
    .select("times_redeemed");
  if (promoError) throw new Error(promoError.message);
  const promoRedemptions = (promoRows ?? []).reduce(
    (sum, r) => sum + (r.times_redeemed ?? 0),
    0
  );

  // Derniers comptes créés.
  let accountsQuery = admin
    .from("profiles")
    .select("id, email, full_name, plan, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  if (excluded) accountsQuery = accountsQuery.not("id", "in", excluded);
  const { data: recentAccounts, error: accountsError } = await accountsQuery;
  if (accountsError) throw new Error(accountsError.message);

  // Derniers abonnements payants.
  let recentSubsQuery = admin
    .from("subscriptions")
    .select("user_id, plan, status, provider, updated_at")
    .neq("plan", "free")
    .order("updated_at", { ascending: false })
    .limit(6);
  if (excluded) recentSubsQuery = recentSubsQuery.not("user_id", "in", excluded);
  const { data: recentSubs, error: recentSubsError } = await recentSubsQuery;
  if (recentSubsError) throw new Error(recentSubsError.message);
  const subUserIds = (recentSubs ?? []).map((s) => s.user_id as string);
  const emails = new Map<string, string>();
  if (subUserIds.length > 0) {
    const { data: subProfiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", subUserIds);
    for (const p of subProfiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
  }

  const auditSelect = "id, admin_email, action, target_label, result, detail, created_at";
  const [{ data: recentErrors }, { data: recentActivity }] = await Promise.all([
    admin
      .from("admin_audit_logs")
      .select(auditSelect)
      .eq("result", "error")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("admin_audit_logs")
      .select(auditSelect)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const paidTotal = starter + pro + business;
  return {
    totalUsers,
    activeUsers30,
    newUsers7,
    newUsers30,
    freeUsers: Math.max(0, totalUsers - paidTotal),
    planCounts: { starter, pro, business },
    founderMembers,
    activeSubscriptions,
    canceledSubscriptions,
    pastDueSubscriptions,
    monthlyRevenueCents,
    promoRedemptions,
    recentAccounts: (recentAccounts ?? []) as RecentAccount[],
    recentSubscriptions: ((recentSubs ?? []) as Omit<RecentSubscription, "email">[]).map(
      (s) => ({ ...s, email: emails.get(s.user_id) ?? "" })
    ),
    recentErrors: (recentErrors ?? []) as AuditRow[],
    recentActivity: (recentActivity ?? []) as AuditRow[],
  };
}
