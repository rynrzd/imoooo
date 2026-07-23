import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionNow,
  syncSubscriptionFromStripe,
} from "@/lib/admin/actions/subscriptions";
import { reactivateUser, suspendUser } from "@/lib/admin/actions/users";
import { getAdminContext } from "@/lib/admin/auth";
import type { ActionResult } from "@/lib/admin/types";

export const runtime = "nodejs";

/**
 * POST /api/admin/subscriptions — actions de gestion d'abonnement.
 *
 * Route serveur SÉCURISÉE : le rôle administrateur est vérifié EN BASE
 * (clé secrète, table admin_users) avant toute action ; chaque action
 * délègue à une Server Action déjà auditée (Stripe = source de vérité,
 * journal admin_audit_logs). Le navigateur ne fait qu'appeler cette route.
 *
 * Corps : { action, userId, reason? }
 *  - "sync"              → resynchronise l'abonnement depuis Stripe
 *  - "cancel_period_end" → annule à la fin de la période (Stripe puis base)
 *  - "cancel_now"        → annule immédiatement (Stripe puis base)
 *  - "suspend"           → suspend l'ACCÈS Nireo (ban Auth) sans toucher Stripe
 *  - "reactivate"        → rétablit l'accès d'un compte suspendu
 */

type Action = "sync" | "cancel_period_end" | "cancel_now" | "suspend" | "reactivate";

const ACTIONS: Record<Action, (userId: string, reason: string) => Promise<ActionResult>> = {
  sync: (userId) => syncSubscriptionFromStripe(userId),
  cancel_period_end: (userId) => cancelSubscriptionAtPeriodEnd(userId),
  cancel_now: (userId) => cancelSubscriptionNow(userId),
  suspend: (userId, reason) =>
    suspendUser(userId, reason || "Accès suspendu depuis la gestion des abonnements."),
  reactivate: (userId, reason) =>
    reactivateUser(userId, reason || "Accès rétabli depuis la gestion des abonnements."),
};

export async function POST(request: Request) {
  // Garde de session : au moins un administrateur actif. Le rôle précis
  // (owner/admin) est revérifié dans chaque Server Action déléguée.
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Accès administrateur requis." }, { status: 403 });
  }

  let body: { action?: unknown; userId?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const action = body.action;
  const userId = body.userId;
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (typeof action !== "string" || !(action in ACTIONS)) {
    return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
  }
  if (typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json({ ok: false, error: "Utilisateur manquant." }, { status: 400 });
  }

  try {
    const result = await ACTIONS[action as Action](userId, reason);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    logger.error("api/admin/subscriptions", e);
    return NextResponse.json(
      { ok: false, error: "Action impossible. Réessayez." },
      { status: 500 }
    );
  }
}
