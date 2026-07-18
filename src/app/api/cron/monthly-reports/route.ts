import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import { monthlyReportEmail } from "@/lib/email/templates";
import { formatCurrency } from "@/lib/format";
import { planHasFeature } from "@/config/plans";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST/GET /api/cron/monthly-reports — rapport mensuel automatique par e-mail
 * (plans Pro et Business+ : fonctionnalité `monthly_reports`).
 * À appeler par un planificateur le 1er de chaque mois avec
 * `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron : voir vercel.json).
 *
 * Le rapport couvre le MOIS PRÉCÉDENT, calculé uniquement depuis la base
 * (loyers encaissés, dépenses, occupation, retards, travaux). Idempotent :
 * email_logs (user_id, dedupe_key `monthly_report:AAAA-MM`) — jamais de doublon.
 * 503 explicite sans CRON_SECRET, fournisseur e-mail ou clé admin.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "provider_not_configured : CRON_SECRET absent — rapports mensuels inactifs." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!isEmailProviderConfigured || !isAdminConfigured) {
    return NextResponse.json(
      { error: "provider_not_configured : fournisseur e-mail ou clé admin manquant — aucun envoi." },
      { status: 503 }
    );
  }

  // Mois précédent : bornes calendaires et libellé français.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthKey = start.toISOString().slice(0, 7); // AAAA-MM
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const monthLabel = start.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const admin = createAdminClient();
  let sent = 0;
  let skipped = 0;

  try {
    // Profils éligibles (plan lu en base — jamais fourni par le client).
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, plan");
    if (profilesError) throw new Error(profilesError.message);

    for (const profile of profiles ?? []) {
      if (!planHasFeature(profile.plan, "monthly_reports")) {
        skipped += 1;
        continue;
      }

      const userId = profile.id as string;
      const [properties, payments, expenses, works, owner] = await Promise.all([
        admin.from("properties").select("id, status").eq("owner_id", userId),
        admin
          .from("rent_payments")
          .select("expected, received, status, month")
          .eq("owner_id", userId)
          .gte("month", startIso)
          .lt("month", endIso),
        admin
          .from("expenses")
          .select("amount")
          .eq("owner_id", userId)
          .gte("date", startIso)
          .lt("date", endIso),
        admin
          .from("maintenance_records")
          .select("id")
          .eq("owner_id", userId)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString()),
        admin.auth.admin.getUserById(userId),
      ]);
      const queryError =
        properties.error ?? payments.error ?? expenses.error ?? works.error;
      if (queryError) throw new Error(queryError.message);

      const recipient = owner.data?.user?.email ?? null;
      const propertyRows = properties.data ?? [];
      // Aucun envoi sans destinataire ni patrimoine : rien à rapporter.
      if (!recipient || propertyRows.length === 0) {
        skipped += 1;
        continue;
      }

      const paymentRows = payments.data ?? [];
      const revenue = paymentRows.reduce((acc, p) => acc + Number(p.received), 0);
      const totalExpenses = (expenses.data ?? []).reduce(
        (acc, e) => acc + Number(e.amount),
        0
      );
      const late = paymentRows.filter((p) => p.status === "retard");
      const lateAmount = late.reduce(
        (acc, p) => acc + (Number(p.expected) - Number(p.received)),
        0
      );
      const occupied = propertyRows.filter((p) => p.status === "loue").length;
      const occupancy = Math.round((occupied * 100) / propertyRows.length);

      // Réservation idempotente : la ligne email_logs existe → déjà envoyé.
      const dedupeKey = `monthly_report:${monthKey}`;
      const content = monthlyReportEmail({
        monthLabel,
        revenue: formatCurrency(revenue),
        expenses: formatCurrency(totalExpenses),
        net: formatCurrency(revenue - totalExpenses),
        occupancy: `${occupancy} %`,
        propertiesCount: propertyRows.length,
        latePayments: late.length,
        lateAmount: formatCurrency(lateAmount),
        newWorks: (works.data ?? []).length,
      });
      const { error: logError } = await admin.from("email_logs").insert({
        user_id: userId,
        kind: "monthly_report",
        recipient,
        subject: content.subject,
        status: "sent",
        dedupe_key: dedupeKey,
      });
      if (logError) {
        skipped += 1; // doublon (contrainte unique) ou erreur : pas d'envoi
        continue;
      }

      try {
        await sendEmail({ to: recipient, subject: content.subject, html: content.html });
        sent += 1;
      } catch (e) {
        await admin
          .from("email_logs")
          .update({ status: "failed", error: e instanceof Error ? e.message : "unknown" })
          .eq("user_id", userId)
          .eq("dedupe_key", dedupeKey);
        logger.error("cron/monthly-reports", e);
      }
    }

    return NextResponse.json({ month: monthKey, sent, skipped });
  } catch (e) {
    logger.error("cron/monthly-reports", e);
    return NextResponse.json({ error: "Traitement interrompu.", sent, skipped }, { status: 500 });
  }
}

/** Vercel Cron appelle en GET : même traitement, mêmes garde-fous. */
export const GET = POST;
