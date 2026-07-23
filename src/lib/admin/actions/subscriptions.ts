"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { syncSubscriptionToDatabase, type SubscriptionRow } from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import type { ActionResult } from "../types";

/**
 * Server Actions — abonnements. Stripe est la SOURCE DE VÉRITÉ : toute
 * annulation/synchronisation passe par l'API Stripe côté serveur, puis la
 * base est resynchronisée. Jamais de modification Supabase seule quand un
 * paiement réel est concerné.
 */

async function loadStripeSubscription(userId: string): Promise<{
  row: SubscriptionRow;
  email: string;
}> {
  const admin = createAdminClient();
  const [{ data: sub, error }, { data: profile }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("email").eq("id", userId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const row = sub as SubscriptionRow | null;
  if (!row?.stripe_subscription_id) {
    throw new Error("Aucun abonnement Stripe associé à ce compte.");
  }
  return { row, email: (profile?.email as string) ?? userId };
}

/** Annulation à la fin de la période en cours (le client garde l'accès payé). */
export async function cancelSubscriptionAtPeriodEnd(userId: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    if (!isStripeConfigured) return { ok: false, error: "Stripe n'est pas configuré." };
    const { row, email } = await loadStripeSubscription(userId);
    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(row.stripe_subscription_id as string, {
      cancel_at_period_end: true,
    });
    await syncSubscriptionToDatabase(createAdminClient(), userId, updated);
    await logAdminAction(ctx, {
      action: "subscription.cancel_period_end",
      targetUserId: userId,
      targetLabel: email,
      oldValue: { status: row.status, cancel_at_period_end: row.cancel_at_period_end },
      newValue: { cancel_at_period_end: true },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Abonnement annulé à la fin de la période en cours." };
  } catch (e) {
    logger.error("admin/subscriptions", e);
    await logAdminAction(ctx, {
      action: "subscription.cancel_period_end",
      targetUserId: userId,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Annulation impossible." };
  }
}

/** Annulation immédiate (accès payant coupé tout de suite). */
export async function cancelSubscriptionNow(userId: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    if (!isStripeConfigured) return { ok: false, error: "Stripe n'est pas configuré." };
    const { row, email } = await loadStripeSubscription(userId);
    const stripe = getStripe();
    const canceled = await stripe.subscriptions.cancel(row.stripe_subscription_id as string);
    await syncSubscriptionToDatabase(createAdminClient(), userId, canceled);
    await logAdminAction(ctx, {
      action: "subscription.cancel_now",
      targetUserId: userId,
      targetLabel: email,
      oldValue: { status: row.status, plan: row.plan },
      newValue: { status: "canceled" },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Abonnement annulé immédiatement." };
  } catch (e) {
    logger.error("admin/subscriptions", e);
    await logAdminAction(ctx, {
      action: "subscription.cancel_now",
      targetUserId: userId,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Annulation impossible." };
  }
}

/** Resynchronise la base depuis Stripe (état Stripe = état affiché). */
export async function syncSubscriptionFromStripe(userId: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction();
    if (!isStripeConfigured) return { ok: false, error: "Stripe n'est pas configuré." };
    const { row, email } = await loadStripeSubscription(userId);
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      row.stripe_subscription_id as string
    );
    await syncSubscriptionToDatabase(createAdminClient(), userId, subscription);
    await logAdminAction(ctx, {
      action: "subscription.sync",
      targetUserId: userId,
      targetLabel: email,
      newValue: { status: subscription.status },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Abonnement resynchronisé depuis Stripe." };
  } catch (e) {
    logger.error("admin/subscriptions", e);
    await logAdminAction(ctx, {
      action: "subscription.sync",
      targetUserId: userId,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Synchronisation impossible." };
  }
}
