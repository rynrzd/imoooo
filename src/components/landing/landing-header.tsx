"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/**
 * Header de la landing — une barre pleine, un filet, rien d'autre.
 *
 * Au repos elle est transparente sur l'ivoire ; dès le premier défilement
 * elle devient opaque et pose un filet net. Aucun flou, aucune pilule
 * flottante, aucune ombre diffuse. Sa hauteur réelle est publiée dans
 * `--land-header-h` (globals.css) : c'est elle qui donne le
 * `scroll-margin-top` des ancres, donc aucun titre ne passe dessous.
 */

const NAV_LINKS = [
  { label: "Fonctionnalités", hash: "#fonctionnalites" },
  { label: "Tarifs", hash: "#tarifs" },
  { label: "FAQ", hash: "#faq" },
];

export function LandingHeader() {
  const [open, setOpen] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Détection non bloquante de la session : les CTA visiteur restent corrects
  // tant que la réponse n'est pas arrivée.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setConnected(Boolean(session)));
  }, []);

  // Échap referme le menu mobile.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={cn(
        // Le fond ivoire est posé DÈS LE RENDU SERVEUR (il se confond avec la
        // page tant qu'on n'a pas défilé) : la barre reste opaque même avant
        // l'hydratation, donc jamais de contenu qui transparaît dessous.
        // Seul le filet inférieur apparaît au défilement.
        "sticky top-0 z-50 border-b bg-[var(--land-ivory)] pt-[env(safe-area-inset-top)] transition-colors duration-200",
        scrolled || open ? "border-border" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-[76rem] items-center gap-4 px-4 sm:h-16 sm:px-6">
        <NireoLogo flat compact />

        {/* À 768 px la barre est pleine : la navigation se resserre pour que le
            bouton principal ne touche jamais le bord. */}
        <nav aria-label="Navigation principale" className="ml-3 hidden items-center gap-0.5 md:flex lg:ml-6 lg:gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.hash}
              href={link.hash}
              className="rounded-[4px] px-2.5 py-2 text-[0.9rem] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground lg:px-3"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          {connected ? (
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-2 rounded-[5px] bg-primary px-4 text-[0.9rem] font-medium text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_88%,var(--land-ink))]"
            >
              <LayoutDashboard className="size-4" aria-hidden />
              Ouvrir le tableau de bord
            </Link>
          ) : (
            <>
              <Link
                href="/connexion"
                onClick={() => track("cta_connexion", { source: "header" })}
                className="inline-flex h-9 items-center rounded-[5px] px-3 text-[0.9rem] font-medium text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--land-ink)_6%,transparent)]"
              >
                Se connecter
              </Link>
              <Link
                href="/inscription"
                data-lx="header-cta"
                data-lx-cta=""
                onClick={() => track("cta_essai_gratuit", { source: "header" })}
                className="inline-flex h-9 items-center rounded-[5px] bg-primary px-4 text-[0.9rem] font-medium whitespace-nowrap text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_88%,var(--land-ink))]"
              >
                Commencer gratuitement
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto grid size-11 shrink-0 place-items-center rounded-[5px] border border-border text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="menu-landing-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Menu mobile — panneau plein largeur, sous la barre, jamais flottant. */}
      {open ? (
        <div id="menu-landing-mobile" className="border-t border-border bg-[var(--land-ivory)] md:hidden">
          <nav aria-label="Navigation mobile" className="mx-auto w-full max-w-[76rem] px-4 py-3">
            <ul className="divide-y divide-border">
              {NAV_LINKS.map((link) => (
                <li key={link.hash}>
                  <a
                    href={link.hash}
                    onClick={close}
                    className="flex min-h-12 items-center text-[0.95rem] text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2">
              {connected ? (
                <Link
                  href="/"
                  onClick={close}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[5px] bg-primary px-4 text-[0.95rem] font-medium text-[var(--land-paper)]"
                >
                  <LayoutDashboard className="size-4" aria-hidden />
                  Ouvrir le tableau de bord
                </Link>
              ) : (
                <>
                  <Link
                    href="/inscription"
                    data-lx="menu-mobile-cta"
                    data-lx-cta=""
                    onClick={() => {
                      track("cta_essai_gratuit", { source: "menu_mobile" });
                      close();
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-[5px] bg-primary px-4 text-[0.95rem] font-medium text-[var(--land-paper)]"
                  >
                    Commencer gratuitement
                  </Link>
                  <Link
                    href="/connexion"
                    onClick={() => {
                      track("cta_connexion", { source: "menu_mobile" });
                      close();
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-[5px] border border-border bg-[var(--land-paper)] px-4 text-[0.95rem] font-medium text-foreground"
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
