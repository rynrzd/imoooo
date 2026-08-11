"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutDashboard, X } from "lucide-react";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/**
 * Header de la landing — la marque à gauche, un bouton menu à droite.
 *
 * Il est posé SUR la photographie du hero : transparent en haut de page, plein
 * (bleu nuit) dès le premier défilement. Aucune barre flottante, aucun flou.
 *
 * Le menu est un panneau plein écran, volontairement court : quatre entrées
 * réellement utiles. Il est utilisable au clavier — Échap ferme et rend le
 * focus au bouton, le focus entre dans le panneau à l'ouverture, le panneau
 * est un `dialog` modal et le défilement de la page est gelé pendant qu'il
 * est ouvert.
 */

const MENU_LINKS = [
  { label: "Produit", href: "/#produit" },
  { label: "FAQ", href: "/tarifs#faq" },
];

export function LandingHeader({ announcement }: { announcement?: string }) {
  const [open, setOpen] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const panel = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Détection non bloquante de la session : les liens visiteur restent
  // corrects tant que la réponse n'est pas arrivée.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setConnected(Boolean(session)));
  }, []);

  // Menu ouvert : Échap ferme, le défilement de la page est gelé, et le
  // premier élément du panneau reçoit le focus.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => setOpen(false);
  /** Barre pleine dès qu'on a défilé, qu'une annonce est posée, ou menu ouvert. */
  const solid = scrolled || open || Boolean(announcement);

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      {announcement ? (
        <div className="bg-[var(--nl-cobalt)] px-4 py-2 text-center text-[0.82rem] font-medium text-white">
          {announcement}
        </div>
      ) : null}

      {/* `relative z-50` : la barre reste AU-DESSUS du panneau de menu, la
          marque et la croix de fermeture ne sont donc jamais recouvertes.
          Aucune marge de sécurité iOS ici : le segment n'utilise plus
          `viewport-fit=cover`, la hauteur ci-dessous est donc la hauteur
          réelle — 56 px sur mobile, 68 px à partir de `md`. */}
      <header
        className={cn(
          "relative z-50 transition-colors duration-300",
          solid ? "bg-[var(--nl-night)]" : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-[82rem] items-center justify-between px-5 sm:px-8 md:h-17">
          <NireoLogo
            flat
            onDark
            markClassName="size-10 rounded-[0.5rem] bg-white text-[var(--nl-cobalt)] md:size-9"
          />

          {/* Zone tactile 44 × 44 px minimum, à toutes les tailles. */}
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls="menu-landing"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="-mr-2 inline-grid size-11 place-items-center rounded-md text-white transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            {open ? (
              <X className="size-6" aria-hidden />
            ) : (
              // Trois filets nets — le trait de la maquette, pas une icône générique.
              <span aria-hidden className="flex w-6 flex-col gap-[5px]">
                <span className="h-[2px] w-full bg-current" />
                <span className="h-[2px] w-full bg-current" />
                <span className="h-[2px] w-full bg-current" />
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Panneau de menu — plein écran, bleu nuit, quatre entrées. */}
      {open ? (
        <div
          ref={panel}
          id="menu-landing"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 top-0 z-40 flex flex-col justify-center bg-[var(--nl-night)] px-6 pt-20 pb-10 sm:px-10"
        >
          <nav aria-label="Navigation principale">
            <ul className="mx-auto flex w-full max-w-[82rem] flex-col gap-1">
              {MENU_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    className="flex min-h-14 items-center text-[1.75rem] font-semibold tracking-[-0.03em] text-white transition-colors hover:text-[var(--nl-cobalt-bright)] sm:text-[2.25rem]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mx-auto mt-10 flex w-full max-w-[82rem] flex-col gap-3 sm:flex-row sm:items-center">
            {connected ? (
              <Link
                href="/"
                onClick={close}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-6 text-[0.95rem] font-medium text-white"
              >
                <LayoutDashboard className="size-4" aria-hidden />
                Ouvrir le tableau de bord
              </Link>
            ) : (
              <>
                <Link
                  href="/inscription"
                  data-lx="menu-cta"
                  data-lx-cta=""
                  onClick={() => {
                    track("cta_essai_gratuit", { source: "menu" });
                    close();
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-md bg-[var(--nl-cobalt)] px-6 text-[0.95rem] font-medium text-white transition-colors hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#fff)]"
                >
                  Commencer gratuitement
                </Link>
                <Link
                  href="/connexion"
                  onClick={() => {
                    track("cta_connexion", { source: "menu" });
                    close();
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-md border border-white/25 px-6 text-[0.95rem] font-medium text-white transition-colors hover:bg-white/10"
                >
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
