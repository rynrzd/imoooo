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
 *
 * Encombrement mobile volontairement minimal : barre de 52 px (58 px marge
 * comprise une fois détachée), largeur `calc(100% - 24px)`, encoche iPhone
 * absorbée par `env(safe-area-inset-top)`. La hauteur réelle est publiée dans
 * `--nireo-header-h` (globals.css) : c'est elle qui alimente le
 * `scroll-margin-top` des ancres, donc aucun titre ne peut passer dessous.
 */

const NAV_LINKS = [
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

  // Échap referme le menu mobile (le panneau n'a pas de zone de fermeture).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // La landing vit sur « / » (et « /accueil » pour les connectés).
  const onLanding = pathname === "/" || pathname === "/accueil";
  const anchor = (hash: string) => (onLanding ? hash : `/${hash}`);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div
        className={cn(
          "mx-auto flex h-13 items-center justify-between gap-3 transition-all duration-300 ease-out sm:h-14 sm:gap-4",
          scrolled
            ? "mt-1.5 w-[calc(100%-24px)] rounded-2xl border border-border bg-background/85 px-2.5 shadow-[0_16px_40px_-24px_oklch(0.28_0.03_235/0.55)] backdrop-blur-xl sm:mt-2.5 sm:w-[min(72rem,calc(100%-1rem))] sm:px-4"
            : "w-[calc(100%-24px)] max-w-6xl border border-transparent sm:w-full sm:px-6"
        )}
      >
        <NireoLogo compact />

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
          className="nireo-glass-soft flex size-10.5 shrink-0 items-center justify-center rounded-xl text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Menu mobile — panneau flottant aligné sur la pilule du header. */}
      {open ? (
        <div
          id="menu-mobile"
          className="mx-3 mt-2 rounded-2xl border border-border bg-background/95 backdrop-blur-xl md:hidden"
        >
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1 p-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.hash}
                href={anchor(link.hash)}
                onClick={close}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm text-foreground hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {connected ? (
                <Link href="/" onClick={close} className={buttonVariants({ className: "h-11 w-full" })}>
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
                    className={buttonVariants({ className: "h-11 w-full" })}
                  >
                    Essayer gratuitement
                  </Link>
                  <Link
                    href="/connexion"
                    onClick={() => {
                      track("cta_connexion", { source: "menu_mobile" });
                      close();
                    }}
                    className={buttonVariants({ variant: "outline", className: "h-11 w-full" })}
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
