import type { Metadata } from "next";
import Link from "next/link";
import { NidBottomNav, NidSidebar } from "@/components/nireo-id/app-nav";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { isNireoIdConfigured, NID_UNAVAILABLE, nidUserClient } from "@/features/nireo-id/server/client";
import { getNidAdminContext, requireNidSession } from "@/features/nireo-id/server/guards";

/**
 * Espace personnel Nireo ID.
 *
 * L'authentification est celle de Nireo (compte unique) : aucun second
 * système de comptes. Un visiteur non connecté est renvoyé vers la
 * connexion partagée avec un retour vers la page demandée.
 */

export const metadata: Metadata = {
  title: { default: "Mes objets", template: "%s · Nireo ID" },
  robots: { index: false, follow: false },
};

async function loadCounts(userEmail: string) {
  if (!isNireoIdConfigured) return { transfers: 0, shares: 0 };
  try {
    const supabase = await nidUserClient();
    const [transfers, shares] = await Promise.all([
      supabase
        .from("nid_transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "en_attente")
        .ilike("recipient_email", userEmail),
      supabase
        .from("nid_share_links")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);
    return { transfers: transfers.count ?? 0, shares: shares.count ?? 0 };
  } catch {
    // Schéma non encore appliqué : la navigation reste utilisable sans badge.
    return { transfers: 0, shares: 0 };
  }
}

export default async function NireoIdAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireNidSession("/id/app");
  const [counts, adminContext] = await Promise.all([
    loadCounts(session.email),
    getNidAdminContext(),
  ]);

  return (
    <div className="min-h-svh bg-background">
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center px-5">
          <NidLogo href="/id/app" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <NidSidebar counts={counts} isAdmin={Boolean(adminContext)} />
        </div>
        <div className="border-t border-border px-5 py-4">
          <p className="truncate text-xs text-muted-foreground" title={session.email}>
            {session.email}
          </p>
          <Link
            href="/id/app/parametres"
            className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
          >
            Compte et confidentialité
          </Link>
        </div>
      </aside>

      {/* En-tête (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <NidLogo href="/id/app" size="sm" />
        <Link
          href="/id/app/parametres"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Mon compte
        </Link>
      </header>

      <main className="pb-24 lg:pb-10 lg:pl-64">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {!isNireoIdConfigured ? (
            <p className="mb-6 rounded-2xl border border-[color-mix(in_srgb,var(--nid-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-warning)_10%,transparent)] p-4 text-sm text-foreground">
              {NID_UNAVAILABLE}
            </p>
          ) : null}
          {children}
        </div>
      </main>

      <NidBottomNav counts={counts} />
    </div>
  );
}
