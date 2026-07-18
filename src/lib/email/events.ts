/**
 * E-mails automatiques — dérivation des événements à envoyer.
 * PURE : aucune requête, aucun envoi. Un futur déclencheur planifié
 * (cron Vercel / Edge Function) appellera `getPendingEmailEvents` puis
 * `sendEmail` UNIQUEMENT si `isEmailConfigured` est vrai et si la
 * préférence e-mail correspondante de l'utilisateur est activée.
 *
 * Rappels de loyers impayés : pilotés par notification_preferences
 * (rent_reminder_mode, rent_reminder_days = J+3/7/15 par défaut,
 * rent_reminder_copy_owner, rent_reminder_custom_message).
 */

import type { AppData } from "@/lib/types";
import { currentMonthKey } from "@/lib/dates";
import type { NotificationPreferences } from "@/lib/supabase/account";

export type EmailEventKind =
  | "rent_due_soon"
  | "rent_late_owner"
  | "rent_late_tenant"
  | "lease_expiring"
  | "document_expiring"
  | "maintenance_overdue"
  | "monthly_report";

export interface EmailEvent {
  kind: EmailEventKind;
  /** Clé d'unicité (évite les envois en double, à journaliser côté cron). */
  dedupeKey: string;
  /** Destinataire logique — l'e-mail réel est résolu au moment de l'envoi. */
  recipient: "owner" | "tenant";
  /** Copie au propriétaire (rappels locataire). */
  copyOwner?: boolean;
  payload: Record<string, string | number>;
}

const DAY_MS = 86_400_000;

export function getPendingEmailEvents(
  data: AppData,
  prefs: NotificationPreferences,
  today = new Date()
): EmailEvent[] {
  const events: EmailEvent[] = [];
  const todayIso = today.toISOString().slice(0, 10);
  const month = currentMonthKey();
  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Logement";

  // Loyers impayés : uniquement aux jalons configurés (J+3/7/15…).
  const reminderDays = prefs.rent_reminder_days ?? [3, 7, 15];
  for (const payment of data.rentPayments) {
    if (payment.status !== "retard") continue;
    const monthStart = new Date(`${payment.month}-01T00:00:00Z`);
    const daysLate = Math.floor((today.getTime() - monthStart.getTime()) / DAY_MS);
    if (!reminderDays.includes(daysLate)) continue;

    if (prefs.rent_reminder_mode === "email_tenant") {
      events.push({
        kind: "rent_late_tenant",
        dedupeKey: `rent_late_tenant:${payment.id}:${daysLate}`,
        recipient: "tenant",
        copyOwner: prefs.rent_reminder_copy_owner,
        payload: {
          propertyId: payment.propertyId,
          propertyName: propertyName(payment.propertyId),
          tenantId: payment.tenantId,
          amount: payment.expected,
          daysLate,
          customMessage: prefs.rent_reminder_custom_message ?? "",
        },
      });
    } else if (prefs.rent_reminder_mode === "email_owner" && prefs.rent_late) {
      events.push({
        kind: "rent_late_owner",
        dedupeKey: `rent_late_owner:${payment.id}:${daysLate}`,
        recipient: "owner",
        payload: {
          propertyName: propertyName(payment.propertyId),
          amount: payment.expected,
          daysLate,
        },
      });
    }
    // mode "notification" : rien par e-mail (centre de notifications seul).
  }

  // Baux arrivant à échéance sous 60 jours.
  if (prefs.lease_expiring) {
    const horizon = new Date(today.getTime() + 60 * DAY_MS).toISOString().slice(0, 10);
    for (const tenant of data.tenants) {
      if (!tenant.exitDate || tenant.exitDate < todayIso || tenant.exitDate > horizon) continue;
      events.push({
        kind: "lease_expiring",
        dedupeKey: `lease_expiring:${tenant.id}:${tenant.exitDate}`,
        recipient: "owner",
        payload: { propertyName: propertyName(tenant.propertyId), endDate: tenant.exitDate },
      });
    }
  }

  // Documents expirant sous 30 jours.
  if (prefs.document_expiring) {
    const horizon = new Date(today.getTime() + 30 * DAY_MS).toISOString().slice(0, 10);
    for (const document of data.documents) {
      if (!document.expiresAt || document.expiresAt > horizon) continue;
      events.push({
        kind: "document_expiring",
        dedupeKey: `document_expiring:${document.id}:${document.expiresAt}`,
        recipient: "owner",
        payload: {
          documentName: document.name,
          propertyName: propertyName(document.propertyId),
          date: document.expiresAt,
        },
      });
    }
  }

  // Chantiers dont la date prévue est dépassée.
  if (prefs.maintenance_overdue) {
    for (const work of data.works) {
      if (work.status !== "en_cours" || work.date >= todayIso) continue;
      events.push({
        kind: "maintenance_overdue",
        dedupeKey: `maintenance_overdue:${work.id}`,
        recipient: "owner",
        payload: { title: work.title, propertyName: propertyName(work.propertyId) },
      });
    }
  }

  // Rapport mensuel : le 1er du mois.
  if (prefs.monthly_report && todayIso.endsWith("-01")) {
    events.push({
      kind: "monthly_report",
      dedupeKey: `monthly_report:${month}`,
      recipient: "owner",
      payload: { month },
    });
  }

  return events;
}
