import type { Metadata } from "next";
import Link from "next/link";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { requireNidAdminPage } from "@/features/nireo-id/server/guards";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Admin Nireo ID" },
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: "/id/admin", label: "Tableau de bord" },
  { href: "/id/admin/professionnels", label: "Professionnels" },
  { href: "/id/admin/signalements", label: "Signalements" },
  { href: "/id/admin/journal", label: "Journal" },
];

/**
 * Administration Nireo ID.
 *
 * Le rôle est vérifié CÔTÉ SERVEUR à chaque requête (`nid_admins`, lue avec
 * la clé secrète) et il est indépendant de l'administration de Nireo Immo :
 * être admin ici ne donne aucun droit là-bas, et réciproquement.
 */
export default async function NidAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { admin } = await requireNidAdminPage();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <NidLogo href="/id/admin" size="sm" />
            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Administration · {admin.role}
            </span>
          </div>
          <Link
            href="/id/app"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Mon espace personnel
          </Link>
        </div>
        <nav
          aria-label="Sections d’administration"
          className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2 pb-2 sm:px-4"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
