"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { isPlanId, type PlanId } from "@/config/plans";
import { getPriceIdForPlan, isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { syncSubscriptionToDatabase, type SubscriptionRow } from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import { deleteUserCompletely } from "../users";
import type { ActionResult, ModerationStatus } from "../types";

/**
 * Server Actions — gestion des comptes clients.
 * Chaque action : contrôle du rôle admin EN BASE, exécution avec la clé
 * secrète, journal d'audit. Aucune action n'est exécutable sans session
 * administrateur active. Les mots de passe ne sont JAMAIS lus ni affichés.
 */

const BAN_FOREVER = "876000h"; // ≈ 100 ans
const SUSPEND_DURATION = "720h"; // 30 jours (réactivable à tout moment)

async function targetEmail(userId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string) ?? userId;
}

async function setModeration(
  userId: string,
  status: ModerationStatus,
  reason: string,
  adminId: string
): Promise<void> {
  const { error } = await createAdminClient()
    .from("user_moderation")
    .upsert(
      {
        user_id: userId,
        status,
        reason,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(error.message);
}

async function moderate(
  userId: string,
  status: ModerationStatus,
  banDuration: string,
  action: string,
  reason: string
): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const admin = createAdminClient();
    const email = await targetEmail(userId);

    // Le blocage effectif passe par Supabase Auth : plus aucune nouvelle
    // session possible (les jetons en cours expirent d'eux-mêmes, < 1 h).
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banDuration,
    });
    if (error) throw new Error(error.message);

    await setModeration(userId, status, reason, ctx.admin.id);
    await logAdminAction(ctx, {
      action,
      targetUserId: userId,
      targetLabel: email,
      newValue: { status, reason },
    });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    logger.error("admin/users", e);
    await logAdminAction(ctx, {
      action,
      targetUserId: userId,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Suspension temporaire (30 jours, réactivable) — connexion bloquée. */
export async function suspendUser(userId: string, reason: string): Promise<ActionResult> {
  return moderate(userId, "suspended", SUSPEND_DURATION, "user.suspend", reason);
}

/** Bannissement (définitif tant qu'il n'est pas levé). */
export async function banUser(userId: string, reason: string): Promise<ActionResult> {
  return moderate(userId, "banned", BAN_FOREVER, "user.ban", reason);
}

/** Réactivation d'un compte suspendu ou banni. */
export async function reactivateUser(userId: string, reason: string): Promise<ActionResult> {
  return moderate(userId, "active", "none", "user.reactivate", reason);
}

/**
 * Suppression DÉFINITIVE d'un compte (rôle owner uniquement) :
 * abonnement Stripe résilié, fichiers supprimés, utilisateur Auth supprimé.
 */
export async function deleteUserAccount(userId: string, reason: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["owner"]);
    const email = await targetEmail(userId);

    // Garde-fou : impossible de supprimer un compte administrateur ici.
    const { data: isAdmin } = await createAdminClient()
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (isAdmin) {
      return { ok: false, error: "Ce compte est un administrateur : suppression refusée." };
    }

    await deleteUserCompletely(userId);
    await logAdminAction(ctx, {
      action: "user.delete",
      targetUserId: userId,
      targetLabel: email,
      newValue: { reason },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Compte supprimé définitivement." };
  } catch (e) {
    logger.error("admin/users", e);
    await logAdminAction(ctx, {
      action: "user.delete",
      targetUserId: userId,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Suppression impossible." };
  }
}

/**
 * Changement de plan exceptionnel.
 * - Abonnement Stripe actif : le changement passe PAR STRIPE (source de
 *   vérité), puis la base est resynchronisée.
 * - Sinon (compte manuel/gratuit) : mise à jour serveur de `subscriptions`.
 * - Un accès à vie Fondateur n'est jamais modifié ici.
 */
export async function changeUserPlan(userId: string, newPlan: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    if (!isPlanId(newPlan)) return { ok: false, error: "Plan inconnu." };
    const admin = createAdminClient();
    const email = await targetEmail(userId);

    const { data: subData, error: subError } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (subError) throw new Error(subError.message);
    const subscription = subData as SubscriptionRow | null;

    if (subscription?.lifetime_access) {
      return {
        ok: false,
        error: "Ce compte a un accès à vie (Fondateur) : le plan ne se change pas ici.",
      };
    }

    const oldPlan = subscription?.plan ?? "free";
    const stripeActive =
      subscription?.provider === "stripe" &&
      subscription.stripe_subscription_id &&
      ["active", "trialing", "past_due"].includes(subscription.status);

    if (stripeActive) {
      if (!isStripeConfigured) {
        return {
          ok: false,
          error:
            "Abonnement Stripe actif mais Stripe n'est pas configuré : " +
            "impossible de changer le plan de façon cohérente.",
        };
      }
      if (newPlan === "free") {
        return {
          ok: false,
          error:
            "Cet abonnement est facturé par Stripe : utilisez « Annuler l'abonnement » " +
            "plutôt qu'un passage manuel au plan Gratuit.",
        };
      }
      const stripe = getStripe();
      const current = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id as string
      );
      const itemId = current.items.data[0]?.id;
      if (!itemId) throw new Error("Abonnement Stripe sans ligne de prix.");
      await stripe.subscriptions.update(current.id, {
        items: [{ id: itemId, price: getPriceIdForPlan(newPlan as Exclude<PlanId, "free">) }],
        proration_behavior: "create_prorations",
      });
      const updated = await stripe.subscriptions.retrieve(current.id);
      await syncSubscriptionToDatabase(admin, userId, updated);
    } else {
      // Compte sans facturation Stripe : mise à jour serveur directe.
      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan: newPlan,
          status: "active",
          provider: "manual",
        },
        { onConflict: "user_id" }
      );
      if (error) throw new Error(error.message);
      const { error: profileError } = await admin
        .from("profiles")
        .update({ plan: newPlan })
        .eq("id", userId);
      if (profileError) throw new Error(profileError.message);
    }

    await logAdminAction(ctx, {
      action: "user.change_plan",
      targetUserId: userId,
      targetLabel: email,
      oldValue: { plan: oldPlan },
      newValue: { plan: newPlan, via: stripeActive ? "stripe" : "manual" },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Plan mis à jour." };
  } catch (e) {
    logger.error("admin/users", e);
    await logAdminAction(ctx, {
      action: "user.change_plan",
      targetUserId: userId,
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Changement impossible." };
  }
}

/** Note interne sur un compte (jamais visible par le client). */
export async function addUserNote(userId: string, note: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction();
    const trimmed = note.trim();
    if (!trimmed) return { ok: false, error: "La note est vide." };
    if (trimmed.length > 2000) return { ok: false, error: "Note trop longue (2000 max)." };
    const { error } = await createAdminClient().from("admin_user_notes").insert({
      user_id: userId,
      note: trimmed,
      created_by: ctx.admin.id,
      created_by_email: ctx.user.email ?? "",
    });
    if (error) throw new Error(error.message);
    await logAdminAction(ctx, {
      action: "user.note",
      targetUserId: userId,
      targetLabel: await targetEmail(userId),
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Note ajoutée." };
  } catch (e) {
    logger.error("admin/users", e);
    return { ok: false, error: e instanceof Error ? e.message : "Ajout impossible." };
  }
}
