import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdminAction } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import {
  approveCommission,
  cancelCommission,
  makeCommissionPayable,
} from "@/lib/marketing/commissions";
import { formatCents } from "@/lib/marketing/types";

export const runtime = "nodejs";

/**
 * POST /api/admin/marketing/commissions — actions sur les commissions.
 *
 * Rôle administrateur vérifié EN BASE avant toute action ; chaque action
 * est journalisée (admin_audit_logs). Les montants ne sont JAMAIS pris
 * du navigateur : tout est relu et validé en base côté serveur.
 *
 * Corps : { action, commissionId, reason? }
 *  - "approve" → pending → approved
 *  - "payable" → approved → payable (disponible pour un relevé)
 *  - "cancel"  → annulation avec raison OBLIGATOIRE (jamais sur une payée)
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

  let body: { action?: unknown; commissionId?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const commissionId = typeof body.commissionId === "string" ? body.commissionId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!commissionId) {
    return NextResponse.json({ ok: false, error: "Commission manquante." }, { status: 400 });
  }

  try {
    switch (action) {
      case "approve": {
        const commission = await approveCommission(commissionId);
        await logAdminAction(ctx, {
          action: "marketing.commission_approve",
          targetUserId: commission.user_id,
          targetLabel: commission.stripe_invoice_id,
          newValue: { amount: formatCents(commission.commission_amount), status: "approved" },
        });
        return NextResponse.json({ ok: true, message: "Commission validée." });
      }
      case "payable": {
        const commission = await makeCommissionPayable(commissionId);
        await logAdminAction(ctx, {
          action: "marketing.commission_payable",
          targetUserId: commission.user_id,
          targetLabel: commission.stripe_invoice_id,
          newValue: { amount: formatCents(commission.commission_amount), status: "payable" },
        });
        return NextResponse.json({ ok: true, message: "Commission disponible pour paiement." });
      }
      case "cancel": {
        const commission = await cancelCommission(commissionId, reason);
        await logAdminAction(ctx, {
          action: "marketing.commission_cancel",
          targetUserId: commission.user_id,
          targetLabel: commission.stripe_invoice_id,
          oldValue: { amount: formatCents(commission.commission_amount) },
          newValue: { status: "cancelled", reason: reason.slice(0, 200) },
        });
        return NextResponse.json({ ok: true, message: "Commission annulée." });
      }
      default:
        return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    logger.error("api/admin/marketing/commissions", e);
    const message = e instanceof Error ? e.message : "Action impossible. Réessayez.";
    await logAdminAction(ctx, {
      action: `marketing.commission_${action}`,
      targetLabel: commissionId,
      result: "error",
      detail: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
