import { ShieldCheck } from "lucide-react";
import { AdminNav, AdminNavMobile } from "@/components/admin/admin-nav";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/admin/auth";
import { ADMIN_ROLE_LABELS } from "@/lib/admin/types";

/**
 * Coquille du panneau d'administration. `requireAdminPage()` vérifie CÔTÉ
 * SERVEUR (clé secrète, table admin_users) que la session appartient à un
 * administrateur actif — un utilisateur normal est redirigé avant tout rendu.
 * Aucun élément du dashboard client n'est réutilisé ici.
 */
export default async function AdminPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, admin } = await requireAdminPage();

  return (
    <div className="min-h-svh bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-background lg:flex">
        <div className="flex items-center gap-2 px-4 pt-5 pb-4">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-[-0.01em]">Nireo</p>
            <p className="text-[11px] text-muted-foreground">Administration</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AdminNav />
        </div>
        <div className="border-t border-border px-3 py-3">
          <div className="mb-2 px-2.5">
            <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
            <Badge variant="outline" className="mt-1.5">
              {ADMIN_ROLE_LABELS[admin.role]}
            </Badge>
          </div>
          <AdminLogoutButton />
        </div>
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-sm font-semibold">Admin Nireo</span>
          </div>
          <Badge variant="outline">{ADMIN_ROLE_LABELS[admin.role]}</Badge>
        </div>
        <AdminNavMobile />
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
