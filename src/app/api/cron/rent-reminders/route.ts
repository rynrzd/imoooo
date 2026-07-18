import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import { rentLateEmail } from "@/lib/email/templates";
import { formatCurrency } from "@/lib/format";
import { planHasFeature } from "@/config/plans";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST/GET /api/cron/rent-reminders — relances AUTOMATIQUES de loyers impayés.
 * À appeler par un planificateur UNE fois par jour avec
 * `Authorization: Bearer ${CRON_SECRET}`.
 * GET est accepté car Vercel Cron invoque les routes en GET (avec le
 * header Authorization ajouté automatiquement quand CRON_SECRET est défini).
 *
 * Garde-fous :
 * - inactif (503 explicite) sans CRON_SECRET, fournisseur e-mail ou clé admin ;
 * - désactivé par utilisateur par défaut (rent_reminder_mode = 'notification') ;
 * - jalons J+3/7/15 configurables par utilisateur ;
 * - idempotent : email_logs (user_id, dedupe_key) uniques — jamais de doublon ;
 * - bail actif et montant restant vérifiés.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "provider_not_configured : CRON_SECRET absent — relances automatiques inactives." },
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

  const admin = createAdminClient();
  let sent = 0;
  let skipped = 0;

  try {
    // Utilisateurs ayant activé une relance par e-mail.
    const { data: prefRows, error: prefError } = await admin
      .from("notification_preferences")
      .select("user_id, rent_reminder_mode, rent_reminder_days, rent_reminder_copy_owner, rent_reminder_custom_message")
      .neq("rent_reminder_mode", "notification");
    if (prefError) throw new Error(prefError.message);

    for (const pref of prefRows ?? []) {
      // Relances automatiques : incluses à partir du plan Pro (plan lu en
      // base — profiles.plan est contrôlé serveur, jamais par le client).
      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("plan")
        .eq("id", pref.user_id)
        .maybeSingle();
      if (!planHasFeature(ownerProfile?.plan, "auto_reminders")) {
        skipped += 1;
        continue;
      }

      const { data: payments, error: payError } = await admin
        .from("rent_payments")
        .select(
          "id, month, expected, received, leases (exit_date, tenants (first_name, last_name, email), properties (name))"
        )
        .eq("owner_id", pref.user_id)
        .eq("status", "retard");
      if (payError) throw new Error(payError.message);

      const { data: ownerData } = await admin.auth.admin.getUserById(pref.user_id);
      const ownerEmail = ownerData?.user?.email ?? null;

      for (const raw of payments ?? []) {
        const payment = raw as unknown as {
          id: string;
          month: string;
          expected: number | string;
          received: number | string;
          leases: {
            exit_date: string | null;
            tenants: { first_name: string; last_name: string; email: string | null } | null;
            properties: { name: string } | null;
          } | null;
        };
        const remaining = Number(payment.expected) - Number(payment.received);
        const daysLate = Math.floor(
          (Date.now() - new Date(`${payment.month.slice(0, 7)}-01`).getTime()) / 86_400_000
        );
        const days: number[] = pref.rent_reminder_days ?? [3, 7, 15];
        // Bail actif, montant restant, jalon atteint.
        if (payment.leases?.exit_date !== null || remaining <= 0 || !days.includes(daysLate)) {
          skipped += 1;
          continue;
        }

        const toTenant = pref.rent_reminder_mode === "email_tenant";
        const recipient = toTenant ? payment.leases?.tenants?.email : ownerEmail;
        if (!recipient) {
          skipped += 1;
          continue;
        }

        const dedupeKey = `${pref.rent_reminder_mode}:${payment.id}:J${daysLate}`;
        // Réservation idempotente : si la ligne existe déjà, on n'envoie pas.
        const { error: logError } = await admin.from("email_logs").insert({
          user_id: pref.user_id,
          kind: "rent_late_auto",
          recipient,
          subject: "",
          status: "sent",
          dedupe_key: dedupeKey,
        });
        if (logError) {
          skipped += 1; // doublon (contrainte unique) ou erreur : pas d'envoi
          continue;
        }

        const content = rentLateEmail({
          recipient: toTenant ? "tenant" : "owner",
          propertyName: payment.leases?.properties?.name ?? "Logement",
          amount: formatCurrency(remaining),
          daysLate,
          customMessage: toTenant ? pref.rent_reminder_custom_message : null,
        });
        try {
          await sendEmail({
            to: recipient,
            cc: toTenant && pref.rent_reminder_copy_owner && ownerEmail ? ownerEmail : undefined,
            subject: content.subject,
            html: content.html,
          });
          await admin
            .from("email_logs")
            .update({ subject: content.subject })
            .eq("user_id", pref.user_id)
            .eq("dedupe_key", dedupeKey);
          sent += 1;
        } catch (e) {
          await admin
            .from("email_logs")
            .update({ status: "failed", subject: content.subject, error: e instanceof Error ? e.message : "unknown" })
            .eq("user_id", pref.user_id)
            .eq("dedupe_key", dedupeKey);
          logger.error("cron/rent-reminders", e);
        }
      }
    }

    return NextResponse.json({ sent, skipped });
  } catch (e) {
    logger.error("cron/rent-reminders", e);
    return NextResponse.json({ error: "Traitement interrompu.", sent, skipped }, { status: 500 });
  }
}

/** Vercel Cron appelle en GET : même traitement, mêmes garde-fous. */
export const GET = POST;
