import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Espace partenaire",
  robots: { index: false, follow: false },
};

/** Layout minimal de l'espace partenaire (hors application client / admin). */
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/partenaire" className="text-lg font-semibold tracking-tight text-foreground">
            Nireo <span className="text-muted-foreground">· Partenaires</span>
          </Link>
        </div>
      </header>
      <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Programme partenaires Nireo — accès réservé aux apporteurs d&apos;affaires.
      </footer>
    </div>
  );
}
