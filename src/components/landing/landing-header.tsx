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
 * Header de la landing — une barre fine, posée SUR la photographie du hero.
 *
 * Au repos : aucun fond, aucun filet, texte ivoire — le hero commence au
 * pixel 0 et la photo n'est jamais amputée d'une bande. Dès le premier
 * défilement : fond ivoire, encre bleu nuit, un filet net. Aucun flou, aucune
 * pilule flottante, aucune ombre.
 *
 * Hauteur réelle publiée dans `--land-header-h` (globals.css) : 3rem sur
 * mobile, 3.5rem ensuite — c'est elle qui donne le décalage du hero et le
 * `scroll-margin-top` des ancres.
 *
 * Le message d'annonce global (piloté depuis /admin/parametres) est rendu ICI,
 * dans la même pile fixe : sans lui la barre est vraiment transparente, avec
 * lui rien ne passe sous le texte.
 */

/** Navigation minimale : le produit, et les tarifs pour qui veut comparer. */
const NAV_LINKS = [
  { label: "Le produit", href: "/#fonctionnalites" },
  { label: "Tarifs", href: "/tarifs" },
];

export function LandingHeader({ announcement }: { announcement?: string }) {
  const [open, setOpen] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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
  /** Barre pleine dès qu'on a défilé ou que le menu mobile est ouvert. */
  const solid = scrolled || open || Boolean(announcement);

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      {/* L'encoche iPhone est absorbée par le PREMIER élément visible de la
          pile, avec son fond : jamais une bande transparente au-dessus d'une
          barre opaque. Sans annonce et en haut de page, elle laisse voir la
          photographie — c'est voulu. */}
      {announcement ? (
        <div className="border-b border-border bg-[var(--land-blue-pale)] px-4 pt-[env(safe-area-inset-top)] pb-1.5 text-center text-[0.8rem] font-medium text-foreground">
          <span className="block pt-1.5">{announcement}</span>
        </div>
      ) : null}

      <header
        className={cn(
          "border-b transition-colors duration-200",
          !announcement && "pt-[env(safe-area-inset-top)]",
          solid
            ? "border-border bg-[var(--land-ivory)]"
            : "border-transparent bg-transparent"
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-[76rem] items-center gap-3 px-5 sm:px-6",
            // Barre fine : 48 px sur mobile, 56 px ensuite.
            "h-12 sm:h-14",
            // Sur la photo, toute la barre passe en ivoire.
            solid ? "text-foreground" : "text-[var(--land-paper)]"
          )}
        >
          <NireoLogo flat compact onDark={!solid} />

          <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-1 md:flex lg:ml-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-[4px] px-2.5 py-1.5 text-[0.88rem] whitespace-nowrap transition-colors",
                  solid
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-[rgb(252_251_248/0.78)] hover:text-[var(--land-paper)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-1.5 md:flex">
            {connected ? (
              <Link
                href="/"
                className="inline-flex h-8 items-center gap-2 rounded-[5px] bg-primary px-3.5 text-[0.88rem] font-medium text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_86%,#fff)]"
              >
                <LayoutDashboard className="size-4" aria-hidden />
                Ouvrir le tableau de bord
              </Link>
            ) : (
              <>
                <Link
                  href="/connexion"
                  onClick={() => track("cta_connexion", { source: "header" })}
                  className={cn(
                    "inline-flex h-8 items-center rounded-[5px] px-3 text-[0.88rem] font-medium transition-colors",
                    solid
                      ? "text-foreground hover:bg-[color-mix(in_srgb,var(--land-ink)_6%,transparent)]"
                      : "text-[var(--land-paper)] hover:bg-[rgb(252_251_248/0.12)]"
                  )}
                >
                  Se connecter
                </Link>
                <Link
                  href="/inscription"
                  data-lx="header-cta"
                  data-lx-cta=""
                  onClick={() => track("cta_essai_gratuit", { source: "header" })}
                  className="inline-flex h-8 items-center rounded-[5px] bg-primary px-3.5 text-[0.88rem] font-medium whitespace-nowrap text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_86%,#fff)]"
                >
                  Commencer gratuitement
                </Link>
              </>
            )}
          </div>

          {/* Mobile : une icône nue, jamais un gros carré encadré. */}
          <button
            type="button"
            className="-mr-2 ml-auto inline-grid size-9 shrink-0 place-items-center rounded-[5px] md:hidden"
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
            <nav aria-label="Navigation mobile" className="mx-auto w-full max-w-[76rem] px-5 py-2">
              <ul className="divide-y divide-border">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={close}
                      className="flex min-h-11 items-center text-[0.95rem] text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 mb-1 flex flex-col gap-2">
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
    </div>
  );
}
