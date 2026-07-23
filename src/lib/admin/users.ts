import { logger } from "@/lib/logger";
import { getStripe } from "@/lib/stripe/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import type { SubscriptionRow } from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUserIds } from "./stats";
import type { ModerationStatus } from "./types";

/**
 * Requêtes de la gestion des utilisateurs (admin, clé secrète).
 * Les administrateurs sont exclus des listes : ils ne sont pas des clients.
 */

export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  created_at: string;
  moderation: ModerationStatus;
  subscription_status: string | null;
  lifetime_access: boolean;
}

export interface UserListFilters {
  q?: string;
  plan?: string;
  statut?: string;
  page: number;
  perPage: number;
}

export interface UserListResult {
  items: UserListItem[];
  total: number;
}

export async function listUsers(filters: UserListFilters): Promise<UserListResult> {
  const admin = createAdminClient();
  const adminIds = await getAdminUserIds(admin);

  let query = admin
    .from("profiles")
    .select("id, email, full_name, plan, created_at", { count: "exact" });

  if (adminIds.length > 0) query = query.not("id", "in", `(${adminIds.join(",")})`);

  if (filters.q) {
    // Échappement des jokers PostgREST pour une recherche littérale.
    const term = filters.q.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }
  if (filters.plan && ["free", "starter", "pro", "business"].includes(filters.plan)) {
    query = query.eq("plan", filters.plan);
  }

  // Filtre par statut de modération : la table user_moderation fait foi.
  if (filters.statut && ["active", "suspended", "banned"].includes(filters.statut)) {
    const { data: moderated, error } = await admin
      .from("user_moderation")
      .select("user_id, status")
      .neq("status", "active");
    if (error) throw new Error(error.message);
    const flagged = (moderated ?? []).filter((m) => m.status === filters.statut);
    if (filters.statut === "active") {
      const excluded = (moderated ?? []).map((m) => m.user_id as string);
      if (excluded.length > 0) query = query.not("id", "in", `(${excluded.join(",")})`);
    } else {
      const ids = flagged.map((m) => m.user_id as string);
      if (ids.length === 0) return { items: [], total: 0 };
      query = query.in("id", ids);
    }
  }

  const from = (filters.page - 1) * filters.perPage;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + filters.perPage - 1);
  if (error) throw new Error(`Lecture des utilisateurs impossible : ${error.message}`);

  const ids = (data ?? []).map((p) => p.id as string);
  const moderationMap = new Map<string, ModerationStatus>();
  const subMap = new Map<string, { status: string; lifetime: boolean }>();
  if (ids.length > 0) {
    const [{ data: moderation }, { data: subs }] = await Promise.all([
      admin.from("user_moderation").select("user_id, status").in("user_id", ids),
      admin.from("subscriptions").select("user_id, status, lifetime_access").in("user_id", ids),
    ]);
    for (const m of moderation ?? []) {
      moderationMap.set(m.user_id as string, m.status as ModerationStatus);
    }
    for (const s of subs ?? []) {
      subMap.set(s.user_id as string, {
        status: s.status as string,
        lifetime: Boolean(s.lifetime_access),
      });
    }
  }

  return {
    total: count ?? 0,
    items: (data ?? []).map((p) => ({
      id: p.id as string,
      email: (p.email as string) ?? "",
      full_name: (p.full_name as string) ?? "",
      plan: (p.plan as string) ?? "free",
      created_at: p.created_at as string,
      moderation: moderationMap.get(p.id as string) ?? "active",
      subscription_status: subMap.get(p.id as string)?.status ?? null,
      lifetime_access: subMap.get(p.id as string)?.lifetime ?? false,
    })),
  };
}

export interface UserNote {
  id: string;
  note: string;
  created_by_email: string;
  created_at: string;
}

export interface UserDetail {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  plan: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  moderation: ModerationStatus;
  moderation_reason: string;
  subscription: SubscriptionRow | null;
  usage: { properties: number; activeTenants: number; documents: number; photos: number };
  founder: { purchase_number: number | null; tier: number | null; amount_cents: number | null; confirmed_at: string | null } | null;
  notes: UserNote[];
  history: {
    id: string;
    admin_email: string;
    action: string;
    result: string;
    detail: string;
    created_at: string;
  }[];
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const admin = createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email, full_name, phone, plan, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture du profil impossible : ${error.message}`);
  if (!profile) return null;

  const countFor = async (table: string, extra?: (q: unknown) => unknown) => {
    let q = admin.from(table).select("id", { count: "exact", head: true }).eq("owner_id", userId);
    if (extra) q = extra(q) as typeof q;
    const { count, error: countError } = await q;
    if (countError) throw new Error(countError.message);
    return count ?? 0;
  };

  const [
    authUser,
    subscription,
    moderation,
    founder,
    notes,
    history,
    properties,
    activeTenants,
    documents,
    photos,
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("user_moderation").select("status, reason").eq("user_id", userId).maybeSingle(),
    admin
      .from("founder_purchases")
      .select("purchase_number, tier, amount_cents, confirmed_at")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .maybeSingle(),
    admin
      .from("admin_user_notes")
      .select("id, note, created_by_email, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_audit_logs")
      .select("id, admin_email, action, result, detail, created_at")
      .eq("target_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    countFor("properties"),
    admin
      .from("leases")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("exit_date", null),
    countFor("documents"),
    countFor("property_photos"),
  ]);

  return {
    id: profile.id as string,
    email: (profile.email as string) ?? "",
    full_name: (profile.full_name as string) ?? "",
    phone: (profile.phone as string) ?? null,
    plan: (profile.plan as string) ?? "free",
    created_at: profile.created_at as string,
    last_sign_in_at: authUser.data.user?.last_sign_in_at ?? null,
    email_confirmed: Boolean(authUser.data.user?.email_confirmed_at),
    moderation: ((moderation.data?.status as ModerationStatus) ?? "active"),
    moderation_reason: (moderation.data?.reason as string) ?? "",
    subscription: (subscription.data as SubscriptionRow | null) ?? null,
    usage: {
      properties,
      activeTenants: activeTenants.count ?? 0,
      documents,
      photos,
    },
    founder: founder.data
      ? {
          purchase_number: founder.data.purchase_number as number | null,
          tier: founder.data.tier as number | null,
          amount_cents: founder.data.amount_cents as number | null,
          confirmed_at: founder.data.confirmed_at as string | null,
        }
      : null,
    notes: (notes.data ?? []) as UserNote[],
    history: (history.data ?? []) as UserDetail["history"],
  };
}

const STORAGE_BUCKETS = [
  "property-documents",
  "property-photos",
  "expense-receipts",
  "profile-avatars",
] as const;

/**
 * Suppression DÉFINITIVE d'un compte client par un administrateur.
 * Ordre identique à la suppression self-service : abonnement Stripe résilié
 * d'abord (sinon facturation fantôme), fichiers Storage, puis utilisateur
 * Auth (cascade sur les tables métier).
 */
export async function deleteUserCompletely(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (subError) throw new Error(`Lecture de l'abonnement impossible : ${subError.message}`);

  const BILLABLE = ["active", "trialing", "past_due", "unpaid", "incomplete"];
  if (subscription?.stripe_subscription_id && BILLABLE.includes(subscription.status)) {
    if (!isStripeConfigured) {
      throw new Error(
        "Un abonnement Stripe actif est associé à ce compte mais Stripe n'est pas " +
          "configuré : résiliez l'abonnement avant de supprimer le compte."
      );
    }
    try {
      await getStripe().subscriptions.cancel(subscription.stripe_subscription_id);
    } catch (stripeError) {
      const code =
        typeof stripeError === "object" && stripeError !== null && "code" in stripeError
          ? (stripeError as { code?: string }).code
          : undefined;
      if (code !== "resource_missing") {
        logger.error("admin/users", stripeError);
        throw new Error(
          "La résiliation Stripe a échoué : compte NON supprimé. Réessayez."
        );
      }
    }
  }

  for (const bucket of STORAGE_BUCKETS) {
    const paths: string[] = [];
    const { data: level1 } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    for (const entry of level1 ?? []) {
      if (entry.id) {
        paths.push(`${userId}/${entry.name}`);
      } else {
        const { data: level2 } = await admin.storage
          .from(bucket)
          .list(`${userId}/${entry.name}`, { limit: 1000 });
        for (const file of level2 ?? []) paths.push(`${userId}/${entry.name}/${file.name}`);
      }
    }
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) throw new Error(`Storage ${bucket} : ${removeError.message}`);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw new Error(deleteError.message);
}
