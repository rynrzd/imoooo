import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdminAction } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import {
  createPartner,
  deletePartner,
  getPartner,
  setPartnerActive,
  updatePartner,
  validatePartnerInput,
} from "@/lib/marketing/partners";
import { buildPartnerLink } from "@/lib/marketing/referral";

export const runtime = "nodejs";

/**
 * POST /api/admin/marketing/partners — gestion des partenaires.
 *
 * Route serveur SÉCURISÉE : rôle administrateur vérifié EN BASE (clé
 * secrète, table admin_users) avant toute action ; le rôle « support »
 * n'a pas accès aux actions marketing. Chaque action est journalisée
 * dans admin_audit_logs. Un utilisateur normal reçoit 403.
 *
 * Corps : { action, partnerId?, values? }
 *  - "create" → crée le partenaire (code + slug + lien uniques générés serveur)
 *  - "update" → met à jour ses informations (code/slug inchangés)
 *  - "toggle" → active/désactive
 *  - "delete" → supprime UNIQUEMENT sans donnée financière liée
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

  let body: { action?: unknown; partnerId?: unknown; values?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const partnerId = typeof body.partnerId === "string" ? body.partnerId : "";
  const values = (body.values ?? {}) as Record<string, unknown>;

  try {
    switch (action) {
      case "create": {
        const input = validatePartnerInput(values);
        const partner = await createPartner(input, ctx.admin.id);
        await logAdminAction(ctx, {
          action: "marketing.partner_create",
          targetLabel: partner.name,
          newValue: { id: partner.id, slug: partner.referral_slug, type: partner.partner_type },
        });
        return NextResponse.json({
          ok: true,
          message: `Partenaire créé. Lien : ${buildPartnerLink(partner.referral_slug)}`,
          partnerId: partner.id,
        });
      }

      case "update": {
        if (!partnerId) return NextResponse.json({ ok: false, error: "Partenaire manquant." }, { status: 400 });
        const before = await getPartner(partnerId);
        if (!before) return NextResponse.json({ ok: false, error: "Partenaire introuvable." }, { status: 404 });
        const input = validatePartnerInput(values);
        const partner = await updatePartner(partnerId, input);
        await logAdminAction(ctx, {
          action: "marketing.partner_update",
          targetLabel: partner.name,
          oldValue: {
            commission: `${before.commission_type} ${before.commission_value}`,
            active: before.is_active,
          },
          newValue: {
            commission: `${partner.commission_type} ${partner.commission_value}`,
            active: partner.is_active,
          },
        });
        return NextResponse.json({ ok: true, message: "Partenaire mis à jour." });
      }

      case "toggle": {
        if (!partnerId) return NextResponse.json({ ok: false, error: "Partenaire manquant." }, { status: 400 });
        const partner = await getPartner(partnerId);
        if (!partner) return NextResponse.json({ ok: false, error: "Partenaire introuvable." }, { status: 404 });
        await setPartnerActive(partnerId, !partner.is_active);
        await logAdminAction(ctx, {
          action: "marketing.partner_toggle",
          targetLabel: partner.name,
          oldValue: { active: partner.is_active },
          newValue: { active: !partner.is_active },
        });
        return NextResponse.json({
          ok: true,
          message: partner.is_active ? "Partenaire désactivé." : "Partenaire activé.",
        });
      }

      case "delete": {
        if (!partnerId) return NextResponse.json({ ok: false, error: "Partenaire manquant." }, { status: 400 });
        const partner = await getPartner(partnerId);
        if (!partner) return NextResponse.json({ ok: false, error: "Partenaire introuvable." }, { status: 404 });
        await deletePartner(partnerId);
        await logAdminAction(ctx, {
          action: "marketing.partner_delete",
          targetLabel: partner.name,
          oldValue: { id: partner.id, slug: partner.referral_slug },
        });
        return NextResponse.json({ ok: true, message: "Partenaire supprimé." });
      }

      default:
        return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    logger.error("api/admin/marketing/partners", e);
    const message = e instanceof Error ? e.message : "Action impossible. Réessayez.";
    await logAdminAction(ctx, {
      action: `marketing.partner_${action}`,
      targetLabel: partnerId,
      result: "error",
      detail: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
