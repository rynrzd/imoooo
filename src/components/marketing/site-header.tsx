"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Header public — sticky, sobre, avec menu mobile accessible.
 * Les ancres pointent vers les sections de la landing ; depuis une autre
 * page publique, elles ramènent vers « /#section ».
 */

const NAV_LINKS = [
  { label: "Démo", hash: "#demo" },
  { label: "Fonctionnalités", hash: "#fonctionnalites" },
  { label: "Tarifs", hash: "#tarifs" },
  { label: "FAQ", hash: "#faq" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // Header « flottant » : au défilement, la barre se détache en pilule.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Détection non bloquante de la session : les CTA par défaut (visiteur)
  // restent corrects tant que la réponse n'est pas arrivée.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setConnected(Boolean(session)));
  }, []);

  // La landing vit sur « / » (et « /accueil » pour les connectés).
  const onLanding = pathname === "/" || pathname === "/accueil";
  const anchor = (hash: string) => (onLanding ? hash : `/${hash}`);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cn(
          "mx-auto flex h-14 items-center justify-between gap-4 transition-all duration-300 ease-out",
          scrolled
            ? "mt-2.5 w-[min(72rem,calc(100%-1rem))] rounded-2xl border border-border bg-background/85 px-3 shadow-[0_16px_40px_-24px_oklch(0.28_0.03_235/0.55)] backdrop-blur-xl sm:px-4"
            : "w-full max-w-6xl border border-transparent px-4 sm:px-6"
        )}
      >
        <NireoLogo />

        <nav
          aria-label="Navigation principale"
          className="nireo-glass-soft hidden items-center gap-0.5 rounded-full px-1.5 py-1 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.hash}
              href={anchor(link.hash)}
              className="rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {connected ? (
            <Link href="/" className={buttonVariants({})}>
              <LayoutDashboard data-icon="inline-start" />
              Ouvrir le tableau de bord
            </Link>
          ) : (
            <>
              <Link
                href="/connexion"
                onClick={() => track("cta_connexion", { source: "header" })}
                className={buttonVariants({ variant: "ghost" })}
              >
                Se connecter
              </Link>
              <Link
                href="/inscription"
                onClick={() => track("cta_essai_gratuit", { source: "header" })}
                className={cn(buttonVariants({}), "nireo-glow nireo-sheen")}
              >
                Essayer gratuitement
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="nireo-glass-soft flex size-9 items-center justify-center rounded-xl text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {/* Menu mobile */}
      {open ? (
        <div id="menu-mobile" className="border-t border-border/70 bg-background/95 backdrop-blur-xl md:hidden">
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.hash}
                href={anchor(link.hash)}
                onClick={close}
                className="rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {connected ? (
                <Link href="/" onClick={close} className={buttonVariants({ className: "w-full" })}>
                  <LayoutDashboard data-icon="inline-start" />
                  Ouvrir le tableau de bord
                </Link>
              ) : (
                <>
                  <Link
                    href="/inscription"
                    onClick={() => {
                      track("cta_essai_gratuit", { source: "menu_mobile" });
                      close();
                    }}
                    className={buttonVariants({ className: "w-full" })}
                  >
                    Essayer gratuitement
                  </Link>
                  <Link
                    href="/connexion"
                    onClick={() => {
                      track("cta_connexion", { source: "menu_mobile" });
                      close();
                    }}
                    className={buttonVariants({ variant: "outline", className: "w-full" })}
                  >
                    Se connecter
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
