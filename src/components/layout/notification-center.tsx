"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
} from "@/lib/supabase/account";
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  syncDerivedNotifications,
  NOTIFICATIONS_PAGE_SIZE,
  type AppNotification,
} from "@/lib/supabase/notifications";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<AppNotification["category"], string> = {
  loyers: "Loyers",
  documents: "Documents",
  travaux: "Travaux",
  securite: "Sécurité",
  abonnements: "Abonnements",
  systeme: "Système",
};

/**
 * Cloche de notifications : alertes matérialisées en base (RLS own-only),
 * compteur de non-lues, lu / tout lu / suppression, pagination.
 */
export function NotificationCenter() {
  const { data, loading } = useAppStore();
  const router = useRouter();
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const syncedRef = React.useRef(false);

  const load = React.useCallback(async (targetPage: number) => {
    const supabase = createClient();
    const result = await fetchNotifications(supabase, targetPage);
    setItems((prev) =>
      targetPage === 1 ? result.items : [...prev, ...result.items]
    );
    setUnread(result.unreadCount);
    setHasMore(result.items.length === NOTIFICATIONS_PAGE_SIZE);
    setPage(targetPage);
  }, []);

  // Au premier chargement des données : matérialise les alertes dérivées
  // (déduplication en base) puis lit la liste.
  React.useEffect(() => {
    if (!isSupabaseConfigured || loading || syncedRef.current) return;
    syncedRef.current = true;
    const supabase = createClient();
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const prefs = await fetchNotificationPreferences(supabase, user.id).catch(
          () => DEFAULT_NOTIFICATION_PREFERENCES
        );
        await syncDerivedNotifications(supabase, user.id, data, prefs);
        await load(1);
      } catch (e) {
        logger.error("notifications/sync", e);
      }
    })();
  }, [loading, data, load]);

  if (!isSupabaseConfigured) return null;

  const markRead = (notification: AppNotification) => {
    if (notification.read) return;
    void markNotificationRead(createClient(), notification.id)
      .then(() => {
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnread((c) => Math.max(0, c - 1));
      })
      .catch((e) => logger.error("notifications/read", e));
  };

  const markUnread = (notification: AppNotification) => {
    if (!notification.read) return;
    void markNotificationUnread(createClient(), notification.id)
      .then(() => {
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n))
        );
        setUnread((c) => c + 1);
      })
      .catch((e) => logger.error("notifications/unread", e));
  };

  const onOpen = (notification: AppNotification) => {
    markRead(notification);
    if (notification.href) router.push(notification.href);
  };

  const onMarkAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead(createClient());
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (notification: AppNotification) => {
    try {
      await deleteNotification(createClient(), notification.id);
      setItems((prev) => prev.filter((n) => n.id !== notification.id));
      if (!notification.read) setUnread((c) => Math.max(0, c - 1));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          {unread > 0 ? (
            <Button size="xs" variant="ghost" disabled={busy} onClick={() => void onMarkAll()}>
              <CheckCheck data-icon="inline-start" />
              Tout lire
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune notification.
            </p>
          ) : (
            items.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "group flex items-start gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0",
                  !notification.read && "bg-primary/[0.04]"
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className="min-w-0 flex-1 text-left outline-none"
                >
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    {!notification.read ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    ) : null}
                    <span className="truncate">{notification.title}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/70 uppercase">
                    {CATEGORY_LABELS[notification.category]} ·{" "}
                    {new Date(notification.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </button>
                <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!notification.read ? (
                    <button
                      type="button"
                      aria-label="Marquer comme lu"
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => markRead(notification)}
                    >
                      <Check className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Marquer comme non lu"
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => markUnread(notification)}
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Supprimer la notification"
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => void onDelete(notification)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {hasMore ? (
          <div className="border-t border-border p-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => void load(page + 1).catch(() => toast.error("Chargement impossible."))}
            >
              Afficher plus
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
