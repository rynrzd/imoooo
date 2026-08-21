import type { Metadata } from "next";
import Link from "next/link";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const metadata: Metadata = {
  title: { default: "Espace professionnel", template: "%s · Nireo ID" },
  robots: { index: false, follow: false },
};

/**
 * Espace professionnel Nireo ID.
 * Session Nireo obligatoire ; le statut du compte professionnel est
 * revérifié en base à chaque action sensible.
 */
export default async function NidProLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireNidSession("/id/pro");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <NidLogo href="/id/pro" size="sm" />
            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Professionnel
            </span>
          </div>
          <Link
            href="/id/app"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Mon espace personnel
          </Link>
        </div>
      </header>

      <main id="contenu" tabIndex={-1} className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
