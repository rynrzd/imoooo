import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdminAction } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { getPartner } from "@/lib/marketing/partners";
import {
  approvePayout,
  cancelPayout,
  createPayout,
  getPayout,
  markPayoutPaid,
} from "@/lib/marketing/payouts";
import { formatCents } from "@/lib/marketing/types";

export const runtime = "nodejs";

/**
 * POST /api/admin/marketing/payouts — relevés de paiement partenaires.
 *
 * v1 : virements MANUELS. Nireo ne déclenche aucun virement bancaire :
 * l'admin crée le relevé, fait le virement, puis le marque « payé ».
 * Le passage à « payé » est ATOMIQUE (fonction SQL) : relevé + commissions
 * basculent ensemble, un relevé déjà payé est refusé (anti double paiement).
 * Chaque action est journalisée dans admin_audit_logs.
 *
 * Corps : { action, ... }
 *  - "create"    → { partnerId, periodStart, periodEnd, notes? }
 *  - "approve"   → { payoutId }
 *  - "mark_paid" → { payoutId, paymentMethod, paymentReference?, notes? }
 *  - "cancel"    → { payoutId }
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireAdminAction(["admin"]);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Accès administrateur requis." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const str = (key: string): string => (typeof body[key] === "string" ? (body[key] as string) : "");

  try {
    switch (action) {
      case "create": {
        const partnerId = str("partnerId");
        const partner = partnerId ? await getPartner(partnerId) : null;
        if (!partner) {
          return NextResponse.json({ ok: false, error: "Partenaire introuvable." }, { status: 404 });
        }
        const { payout, commissionsCount } = await createPayout({
          partnerId,
          periodStart: str("periodStart"),
          periodEnd: str("periodEnd"),
          notes: str("notes"),
          createdBy: ctx.admin.id,
        });
        await logAdminAction(ctx, {
          action: "marketing.payout_create",
          targetLabel: partner.name,
          newValue: {
            payout_id: payout.id,
            total: formatCents(payout.total_amount),
            commissions: commissionsCount,
            period: `${payout.period_start} → ${payout.period_end}`,
          },
        });
        return NextResponse.json({
          ok: true,
          message: `Relevé créé : ${formatCents(payout.total_amount)} (${commissionsCount} commission${commissionsCount > 1 ? "s" : ""}).`,
        });
      }

      case "approve": {
        const payout = await approvePayout(str("payoutId"));
        await logAdminAction(ctx, {
          action: "marketing.payout_approve",
          targetLabel: payout.id,
          newValue: { total: formatCents(payout.total_amount), status: "approved" },
        });
        return NextResponse.json({ ok: true, message: "Relevé approuvé — prêt pour le virement." });
      }

      case "mark_paid": {
        const payoutId = str("payoutId");
        const { totalCents, count } = await markPayoutPaid({
          payoutId,
          paymentMethod: str("paymentMethod"),
          paymentReference: str("paymentReference"),
          notes: str("notes"),
        });
        await logAdminAction(ctx, {
          action: "marketing.payout_paid",
          targetLabel: payoutId,
          newValue: {
            total: formatCents(totalCents),
            commissions: count,
            method: str("paymentMethod"),
            reference: str("paymentReference"),
          },
        });
        return NextResponse.json({
          ok: true,
          message: `Relevé payé : ${formatCents(totalCents)} — ${count} commission${count > 1 ? "s" : ""} soldée${count > 1 ? "s" : ""}.`,
        });
      }

      case "cancel": {
        const payoutId = str("payoutId");
        const payout = await getPayout(payoutId);
        await cancelPayout(payoutId);
        await logAdminAction(ctx, {
          action: "marketing.payout_cancel",
          targetLabel: payoutId,
          oldValue: payout ? { total: formatCents(payout.total_amount), status: payout.status } : null,
        });
        return NextResponse.json({
          ok: true,
          message: "Relevé annulé — les commissions liées redeviennent disponibles.",
        });
      }

      default:
        return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    logger.error("api/admin/marketing/payouts", e);
    const message = e instanceof Error ? e.message : "Action impossible. Réessayez.";
    await logAdminAction(ctx, {
      action: `marketing.payout_${action}`,
      result: "error",
      detail: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
