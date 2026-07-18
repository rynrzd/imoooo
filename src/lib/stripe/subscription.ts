import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { planFromPriceId } from "./config";
import {
  DEFAULT_PLAN_ID,
  getPlan,
  PLAN_ORDER,
  type FeatureId,
  type Plan,
  type PlanId,
} from "@/config/plans";
import { planHasFeature } from "@/config/plans";

/**
 * Abonnements — lecture, usage/quotas, synchronisation Stripe → Supabase.
 * La table `subscriptions` n'est écrite QUE par le serveur (webhook / sync /
 * fonction Fondateur) : la RLS n'accorde aux utilisateurs que la lecture.
 * Le plan effectif n'est JAMAIS pris depuis le navigateur.
 */

/** Statuts donnant accès au plan payant. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: string;
  status: string;
  provider: "manual" | "stripe" | "founder";
  lifetime_access: boolean;
  founder_tier: 1 | 2 | null;
  founder_purchase_number: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/** Ligne d'abonnement de l'utilisateur (null si absente — jamais bloquant). */
export async function getUserSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture de l'abonnement impossible : ${error.message}`);
  return data as SubscriptionRow | null;
}

/** Alias historique. */
export const getSubscription = getUserSubscription;

/** Définition du plan (limites, fonctionnalités) — repli : Gratuit. */
export function getPlanDefinition(planId: string | null | undefined): Plan {
  return getPlan(planId);
}

/**
 * Plan effectif : accès à vie (Fondateur) > abonnement en statut actif >
 * Gratuit. Un compte sans ligne subscriptions est simplement Gratuit.
 */
export function resolvePlan(subscription: SubscriptionRow | null): Plan {
  if (!subscription) return getPlan(DEFAULT_PLAN_ID);
  if (subscription.lifetime_access) return getPlan(subscription.plan);
  if (!ACTIVE_STATUSES.has(subscription.status)) return getPlan(DEFAULT_PLAN_ID);
  return getPlan(subscription.plan);
}

/** Guard serveur : plan effectif de l'utilisateur connecté. */
export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<Plan> {
  return resolvePlan(await getUserSubscription(supabase, userId));
}

/** Guard serveur : la fonctionnalité est-elle incluse dans le plan effectif ? */
export async function userHasFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: FeatureId
): Promise<boolean> {
  const plan = await getUserPlan(supabase, userId);
  return planHasFeature(plan.id, feature);
}

/**
 * Guard serveur : exige un plan minimal (free < starter < pro < business).
 * Lève une erreur française prête à renvoyer en 403.
 */
export async function requirePlan(
  supabase: SupabaseClient,
  userId: string,
  minimum: PlanId
): Promise<Plan> {
  const plan = await getUserPlan(supabase, userId);
  if (PLAN_ORDER[plan.id] < PLAN_ORDER[minimum]) {
    throw new Error(
      `Cette action nécessite au minimum le plan ${getPlan(minimum).name} ` +
        `(plan actuel : ${plan.name}).`
    );
  }
  return plan;
}

/* ------------------------------------------------------------------ */
/* Usage et quotas (comptés en base, jamais fournis par le client)     */
/* ------------------------------------------------------------------ */

export interface Usage {
  properties: number;
  activeTenants: number;
  documents: number;
  photos: number;
  /** Octets réellement enregistrés (documents ; null si non fiable). */
  storageBytes: number | null;
}

/** Compte l'usage réel de l'utilisateur (RLS : ses lignes uniquement). */
export async function getUsage(supabase: SupabaseClient, userId: string): Promise<Usage> {
  const count = (table: string) =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("owner_id", userId);

  const [properties, activeTenants, documents, photos, docSizes] = await Promise.all([
    count("properties"),
    supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("exit_date", null),
    count("documents"),
    count("property_photos"),
    supabase.from("documents").select("size_bytes").eq("owner_id", userId),
  ]);
  for (const r of [properties, activeTenants, documents, photos]) {
    if (r.error) throw new Error(`Lecture de l'usage impossible : ${r.error.message}`);
  }
  const storageBytes = docSizes.error
    ? null
    : (docSizes.data ?? []).reduce((sum, row) => sum + (Number(row.size_bytes) || 0), 0);
  return {
    properties: properties.count ?? 0,
    activeTenants: activeTenants.count ?? 0,
    documents: documents.count ?? 0,
    photos: photos.count ?? 0,
    storageBytes,
  };
}

export interface RemainingQuota {
  properties: number | null;
  activeTenants: number | null;
  documents: number | null;
  photos: number | null;
}

/** Quota restant par ressource (null = illimité). Jamais négatif. */
export function getRemainingQuota(plan: Plan, usage: Usage): RemainingQuota {
  const remaining = (max: number | null, used: number) =>
    max === null ? null : Math.max(0, max - used);
  return {
    properties: remaining(plan.limits.maxProperties, usage.properties),
    activeTenants: remaining(plan.limits.maxActiveTenants, usage.activeTenants),
    documents: remaining(plan.limits.maxDocuments, usage.documents),
    photos: remaining(plan.limits.maxPhotos, usage.photos),
  };
}

/* ------------------------------------------------------------------ */
/* Synchronisation Stripe → Supabase                                   */
/* ------------------------------------------------------------------ */

/** Timestamp Unix Stripe → ISO (null si absent). */
function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

/** Statut Stripe → statuts internes autorisés par la contrainte SQL. */
function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
      return stripeStatus;
    default:
      // incomplete, incomplete_expired, unpaid, paused… : pas d'accès payant.
      return "inactive";
  }
}

/**
 * Synchronise un abonnement Stripe vers Supabase (webhook + resynchronisation).
 * `admin` DOIT être le client admin : l'écriture contourne la RLS.
 * Met aussi à jour `profiles.plan`, lu par les triggers de quotas.
 * Un accès à vie Fondateur n'est JAMAIS écrasé par un événement d'abonnement.
 */
export async function syncSubscriptionToDatabase(
  admin: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const existing = await getUserSubscription(admin, userId);
  if (existing?.lifetime_access) return; // Fondateur : rien à synchroniser.

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const status = mapStatus(subscription.status);
  const plan: PlanId =
    ACTIVE_STATUSES.has(status) && priceId
      ? (planFromPriceId(priceId) ?? DEFAULT_PLAN_ID)
      : DEFAULT_PLAN_ID;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan,
      status,
      provider: "stripe",
      current_period_start: toIso(item?.current_period_start),
      current_period_end: toIso(item?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Enregistrement de l'abonnement impossible : ${error.message}`);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ plan })
    .eq("id", userId);
  if (profileError) {
    throw new Error(`Mise à jour du plan impossible : ${profileError.message}`);
  }
}
