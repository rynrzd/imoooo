import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { COMMISSION_STATUS_LABELS, type CommissionStatus } from "@/lib/marketing/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const STATUSES = ["pending", "approved", "payable", "paid", "cancelled", "reversed"];

/** Échappement CSV (RFC 4180) — jamais de formule Excel involontaire. */
function csvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * GET /api/admin/marketing/commissions/export?partenaire=…&statut=…&depuis=…&jusqu=…
 * Export CSV des commissions (filtres identiques à la page admin).
 * Réservé aux administrateurs actifs — vérification en base.
 */
export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partenaire") ?? "";
  const status = searchParams.get("statut") ?? "";
  const from = searchParams.get("depuis") ?? "";
  const to = searchParams.get("jusqu") ?? "";

  try {
    const admin = createAdminClient();
    let query = admin
      .from("partner_commissions")
      .select("*, marketing_partners(name)")
      .order("earned_at", { ascending: false })
      .limit(10000);
    if (partnerId) query = query.eq("partner_id", partnerId);
    if (STATUSES.includes(status)) query = query.eq("status", status);
    if (from && !Number.isNaN(new Date(from).getTime())) {
      query = query.gte("earned_at", new Date(from).toISOString());
    }
    if (to && !Number.isNaN(new Date(to).getTime())) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      query = query.lt("earned_at", end.toISOString());
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = [...new Set((data ?? []).map((r) => r.user_id as string | null).filter(Boolean))] as string[];
    const emails = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id, email").in("id", userIds);
      for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
    }

    const header = [
      "Date",
      "Partenaire",
      "Client",
      "Plan",
      "Facture Stripe",
      "Montant encaissé (€)",
      "Assiette (€)",
      "Type",
      "Taux",
      "Commission (€)",
      "Statut",
      "Payée le",
      "Raison annulation/remboursement",
    ];
    const lines = [(header.map(csvCell).join(";"))];
    for (const row of data ?? []) {
      const partnerName = (row.marketing_partners as { name?: string } | null)?.name ?? "";
      lines.push(
        [
          csvCell(new Date(row.earned_at as string).toLocaleDateString("fr-FR")),
          csvCell(partnerName),
          csvCell(emails.get((row.user_id as string) ?? "") ?? ""),
          csvCell((row.plan as string) || "—"),
          csvCell(row.stripe_invoice_id as string),
          csvCell(((row.gross_amount as number) / 100).toFixed(2).replace(".", ",")),
          csvCell(((row.eligible_amount as number) / 100).toFixed(2).replace(".", ",")),
          csvCell(row.commission_type === "percent" ? "Pourcentage" : "Fixe"),
          csvCell(
            row.commission_type === "percent"
              ? `${row.commission_rate} %`
              : `${row.commission_rate} €`
          ),
          csvCell(((row.commission_amount as number) / 100).toFixed(2).replace(".", ",")),
          csvCell(COMMISSION_STATUS_LABELS[row.status as CommissionStatus] ?? (row.status as string)),
          csvCell(row.paid_at ? new Date(row.paid_at as string).toLocaleDateString("fr-FR") : ""),
          csvCell((row.reversal_reason as string) ?? ""),
        ].join(";")
      );
    }

    // BOM UTF-8 : accents corrects à l'ouverture dans Excel.
    const csv = "\uFEFF" + lines.join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="commissions-nireo-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    logger.error("api/admin/marketing/commissions/export", e);
    return NextResponse.json({ error: "Export impossible. Réessayez." }, { status: 500 });
  }
}
