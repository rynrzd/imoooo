import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "@/lib/types";
import type { NotificationPreferences } from "./account";

/**
 * Centre de notifications — table `notifications` (RLS own-only).
 * Les alertes dérivées des données (loyers en retard, documents expirants,
 * chantiers dépassés) sont matérialisées avec une clé de déduplication :
 * regénérées à chaque chargement sans jamais créer de doublon.
 */

export type NotificationCategory =
  | "loyers"
  | "documents"
  | "travaux"
  | "securite"
  | "abonnements"
  | "systeme";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  priority: "haute" | "normale" | "basse";
  href: string | null;
  read: boolean;
  created_at: string;
}

export const NOTIFICATIONS_PAGE_SIZE = 15;

export async function fetchNotifications(
  supabase: SupabaseClient,
  page: number
): Promise<{ items: AppNotification[]; unreadCount: number }> {
  const from = (page - 1) * NOTIFICATIONS_PAGE_SIZE;
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, description, category, priority, href, read, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + NOTIFICATIONS_PAGE_SIZE - 1),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false),
  ]);
  if (list.error) throw new Error(list.error.message);
  return {
    items: (list.data ?? []) as AppNotification[],
    unreadCount: unread.count ?? 0,
  };
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markNotificationUnread(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) throw new Error(error.message);
}

export async function deleteNotification(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Matérialise les alertes dérivées des données selon les préférences
 * in-app. Idempotent : `ignoreDuplicates` sur (user_id, dedupe_key).
 */
export async function syncDerivedNotifications(
  supabase: SupabaseClient,
  userId: string,
  data: AppData,
  prefs: NotificationPreferences
): Promise<void> {
  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Logement";
  const rows: {
    user_id: string;
    title: string;
    description: string;
    category: NotificationCategory;
    priority: "haute" | "normale" | "basse";
    href: string | null;
    dedupe_key: string;
  }[] = [];

  if (prefs.rent_late_app) {
    for (const payment of data.rentPayments) {
      if (payment.status !== "retard") continue;
      rows.push({
        user_id: userId,
        title: `Loyer en retard — ${propertyName(payment.propertyId)}`,
        description: `Échéance ${payment.month} : ${payment.expected - payment.received} € restant dû.`,
        category: "loyers",
        priority: "haute",
        href: "/loyers",
        dedupe_key: `rent_late:${payment.id}`,
      });
    }
  }

  if (prefs.document_expiring_app) {
    const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    for (const document of data.documents) {
      if (!document.expiresAt || document.expiresAt > horizon) continue;
      rows.push({
        user_id: userId,
        title: `Document bientôt expiré — ${propertyName(document.propertyId)}`,
        description: `« ${document.name} » expire le ${document.expiresAt}.`,
        category: "documents",
        priority: "normale",
        href: "/documents",
        dedupe_key: `document_expiring:${document.id}:${document.expiresAt}`,
      });
    }
  }

  if (prefs.maintenance_overdue_app) {
    const today = new Date().toISOString().slice(0, 10);
    for (const work of data.works) {
      if (work.status !== "en_cours" || work.date >= today) continue;
      rows.push({
        user_id: userId,
        title: `Chantier en retard — ${propertyName(work.propertyId)}`,
        description: work.title,
        category: "travaux",
        priority: "normale",
        href: "/travaux",
        dedupe_key: `maintenance_overdue:${work.id}`,
      });
    }
  }

  if (rows.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
