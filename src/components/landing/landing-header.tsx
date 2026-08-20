"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { NireoOutline } from "@/components/landing/nireo-outline";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { track } from "@/lib/analytics";
import { CTA_MARKER, trackFunnel } from "@/lib/funnel";
import { PRIMARY_CTA_LABEL, SIGNUP_PATH } from "@/lib/landing/cta";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/**
 * Header de la landing — la marque à gauche, un bouton menu à droite, et le
 * MENU PLEIN ÉCRAN qui s'ouvre par-dessus toute la page.
 *
 * La barre est posée SUR la photographie du hero : transparente en haut de
 * page, pleine (bleu nuit) dès le premier défilement. Aucune barre flottante,
 * aucun flou.
 *
 * Le menu est une superposition `100dvh` qui recouvre le header lui-même :
 * il porte donc sa propre marque et sa propre croix de fermeture, comme la
 * maquette. Quatre entrées, toutes des ancres de la landing — plus une seule
 * ne renvoie vers une page à l'ancienne identité.
 *
 * Ce qui est tenu ici, et qui ne se voit pas :
 *
 * - le défilement de la page est VERROUILLÉ par `position: fixed` sur le
 *   `body` (le seul verrou qui tienne sur iOS ; `overflow: hidden` n'y suffit
 *   pas) et restauré exactement à la même hauteur à la fermeture ;
 * - l'ordre est strict à la fermeture : on referme, on rend le défilement,
 *   PUIS on descend vers la section — sinon la restauration de position
 *   annulerait le défilement fluide ;
 * - le focus est enfermé dans le panneau tant qu'il est ouvert, Échap ferme,
 *   et le focus revient sur le bouton hamburger ;
 * - `popstate` : un retour arrière du navigateur vers une ancre de la landing
 *   redescend à la bonne section (la page ne change jamais d'URL autrement).
 */

const MENU_ID = "menu-landing";

/** Les quatre entrées de la maquette, dans l'ordre, avec leur ancre réelle. */
const MENU_LINKS = [
  { label: "Découvrir", hash: "#decouvrir" },
  { label: "Le produit", hash: "#produit" },
  { label: "Sécurité", hash: "#securite" },
  { label: "FAQ", hash: "#faq" },
] as const;

const HASHES = MENU_LINKS.map((l) => l.hash) as readonly string[];

/** Durée de la fermeture — cf. `.nl-menu[data-state="closing"]` (globals.css). */
const EXIT_MS = 240;

/**
 * Décalage éditorial de chaque entrée, en pourcentage de la largeur utile.
 * Exprimé ainsi, le rythme de la maquette tient de 320 px à 2560 px — et la
 * largeur maximale de l'entrée le déduit (cf. `.nl-menu-item`), aucune ne
 * peut donc déborder.
 */
const OFFSETS = ["0%", "18%", "4%", "18%"] as const;

type MenuState = "closed" | "open" | "closing";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LandingHeader({ announcement }: { announcement?: string }) {
  const pathname = usePathname();
  const [state, setState] = React.useState<MenuState>("closed");
  const [connected, setConnected] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // Le même header sert les pages légales, qui ne portent aucune de ces
  // sections : ailleurs que sur la landing, les entrées deviennent de vrais
  // liens vers « /#… » et le navigateur fait la navigation lui-même.
  const onLanding = pathname === "/" || pathname === "/accueil";

  const panel = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const exitTimer = React.useRef(0);
  /** Une fermeture en cours ne se relance pas (Échap répété, double clic). */
  const closing = React.useRef(false);
  /** Hauteur de défilement au moment du verrouillage, restaurée telle quelle. */
  const scrollY = React.useRef(0);

  const open = state !== "closed";

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

  /* ---------------- Verrou de défilement ---------------- */

  const lockScroll = React.useCallback(() => {
    scrollY.current = window.scrollY;
    const { style } = document.body;
    style.position = "fixed";
    style.top = `-${scrollY.current}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";
  }, []);

  const unlockScroll = React.useCallback(() => {
    const { style } = document.body;
    if (!style.position) return;
    style.position = "";
    style.top = "";
    style.left = "";
    style.right = "";
    style.width = "";
    style.overflow = "";
    window.scrollTo(0, scrollY.current);
  }, []);

  /* ---------------- Ouverture / fermeture ---------------- */

  const openMenu = React.useCallback(() => {
    window.clearTimeout(exitTimer.current);
    closing.current = false;
    lockScroll();
    setState("open");
  }, [lockScroll]);

  /**
   * Ferme le menu. `after` est exécuté APRÈS la restauration du défilement :
   * c'est ce qui permet au saut d'ancre de partir de la bonne position.
   */
  const closeMenu = React.useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      window.clearTimeout(exitTimer.current);
      setState("closing");
      const finish = () => {
        closing.current = false;
        setState("closed");
        unlockScroll();
        if (after) after();
        else trigger.current?.focus();
      };
      if (prefersReducedMotion()) finish();
      else exitTimer.current = window.setTimeout(finish, EXIT_MS);
    },
    [unlockScroll]
  );

  // Filet de sécurité : un démontage pendant que le menu est ouvert ne doit
  // jamais laisser le `body` figé.
  React.useEffect(
    () => () => {
      window.clearTimeout(exitTimer.current);
      unlockScroll();
    },
    [unlockScroll]
  );

  /* ---------------- Clavier : Échap + focus enfermé ---------------- */

  React.useEffect(() => {
    if (!open) return;
    const node = panel.current;
    if (!node) return;

    node.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const targets = Array.from(
        node.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
      );
      if (targets.length === 0) return;
      const first = targets[0];
      const last = targets[targets.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeMenu]);

  /* ---------------- Saut d'ancre ---------------- */

  const scrollToHash = React.useCallback((hash: string) => {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    // La navigation au clavier continue là où le regard atterrit.
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, []);

  const goTo = (hash: string) => {
    closeMenu(() => {
      // Le hash reste dans l'URL, comme un saut d'ancre natif.
      history.pushState(null, "", hash);
      scrollToHash(hash);
    });
  };

  // Retour arrière du navigateur : la landing ne change jamais de page, seul
  // le hash bouge. On ne réagit qu'aux ancres qu'on connaît — le reste (une
  // vraie navigation Next) garde son comportement d'origine.
  React.useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash;
      if (hash && HASHES.includes(hash)) scrollToHash(hash);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [scrollToHash]);

  /**
   * Barre pleine dès qu'on a défilé, qu'une annonce est posée — ou qu'on
   * n'est PAS sur la landing.
   *
   * Le logo et le bouton du menu sont blancs : ils ne sont lisibles que sur
   * un fond sombre. Sur la landing, le hero est une photographie bleu nuit
   * qui commence au pixel 0, donc un header transparent convient. Partout
   * ailleurs, le haut de page est le papier blanc cassé — un header
   * transparent y affichait du blanc sur du blanc, c'est-à-dire un logo et un
   * menu littéralement invisibles tant que le visiteur n'avait pas défilé.
   */
  const solid = scrolled || Boolean(announcement) || !onLanding;

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      {announcement ? (
        <div className="bg-[var(--nl-cobalt)] px-4 py-2 text-center text-[0.82rem] font-medium text-white">
          {announcement}
        </div>
      ) : null}

      {/* Aucune marge de sécurité iOS ici : le segment n'utilise pas
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
            aria-controls={MENU_ID}
            aria-label="Ouvrir le menu"
            onClick={openMenu}
            className="nl-burger nl-focus -mr-2 inline-grid size-11 place-items-center rounded-md text-white"
          >
            {/* Trois filets nets — le trait de la maquette, pas une icône
                générique. Sous le pointeur, celui du milieu se raccourcit par
                la droite (cf. `.nl-burger`, globals.css). */}
            <span aria-hidden className="flex w-6 flex-col gap-[5px]">
              <span className="h-[2px] w-full bg-current" />
              <span className="h-[2px] w-full bg-current" />
              <span className="h-[2px] w-full bg-current" />
            </span>
          </button>
        </div>

        {/* Filet cobalt qui se trace sous la barre au premier défilement :
            c'est ce qui dit que le header s'est « posé » sur la page. */}
        <span aria-hidden className="nl-header-rule" data-on={solid} />
      </header>

      {open ? (
        <div
          ref={panel}
          id={MENU_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
          data-state={state}
          className="nl-menu"
        >
          {/* -------- Marque et fermeture -------- */}
          <div className="nl-menu-brand mx-auto flex h-14 w-full max-w-[82rem] shrink-0 items-center justify-between px-5 sm:px-8 md:h-17">
            <NireoLogo
              flat
              onDark
              markClassName="size-10 rounded-[0.5rem] bg-white text-[var(--nl-cobalt)] md:size-9"
            />
            <button
              type="button"
              onClick={() => closeMenu()}
              aria-label="Fermer le menu"
              className="nl-focus -mr-2 inline-grid size-11 place-items-center rounded-md text-white transition-opacity hover:opacity-70"
            >
              {/* Une croix simple, deux traits — aucun cercle autour. */}
              <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none">
                <path
                  d="M5 5 19 19M19 5 5 19"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* -------- Navigation -------- */}
          <div className="nl-menu-body">
            <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
              <p className="nl-menu-eyebrow">NAVIGATION</p>

              <nav aria-label="Navigation principale">
                <ul className="nl-menu-list">
                  {MENU_LINKS.map((link, index) => {
                    const active = index === 0;
                    return (
                      <li
                        key={link.hash}
                        className="nl-menu-item"
                        style={{
                          ["--nl-i" as string]: index,
                          ["--nl-offset" as string]: OFFSETS[index],
                        }}
                      >
                        {/* Le mot et son trait partagent la MÊME boîte : le
                            soulignement fait donc exactement la largeur du
                            mot, jamais celle de la phrase qui suit. */}
                        <span className="nl-menu-head">
                          <a
                            href={onLanding ? link.hash : `/${link.hash}`}
                            aria-current={active && onLanding ? "true" : undefined}
                            onClick={(event) => {
                              // Hors de la landing, c'est une vraie navigation :
                              // on ferme et on laisse le navigateur faire.
                              if (!onLanding) {
                                closeMenu();
                                return;
                              }
                              if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                              event.preventDefault();
                              goTo(link.hash);
                            }}
                            className="nl-menu-link nl-focus"
                          >
                            {link.label}
                          </a>

                          {active ? (
                            // Le trait bleu et sa flèche : le repère visuel de
                            // l'entrée active, tracé après les quatre liens.
                            <span aria-hidden className="nl-menu-underline">
                              <span className="nl-menu-rule" />
                              <svg
                                viewBox="0 0 8 12"
                                className="nl-menu-arrow"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M1.5 1.5 6 6l-4.5 4.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          ) : null}
                        </span>

                        {active ? (
                          <p className="nl-menu-note">
                            Voyez ce qui change quand tout est enfin au même endroit.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            {/* -------- Le monogramme, en fond -------- */}
            <div aria-hidden className="nl-menu-nzone">
              <NireoOutline
                className="nl-menu-n"
                stroke="var(--nl-cobalt-bright)"
                pathClassName="nl-menu-n-path"
              />
            </div>
          </div>

          {/* -------- Action -------- */}
          <div className="nl-menu-foot mx-auto w-full max-w-[82rem] shrink-0 px-5 sm:px-8">
            {connected ? (
              <Link
                href="/"
                onClick={() => closeMenu()}
                className="nl-menu-cta nl-focus"
              >
                <LayoutDashboard className="size-4" aria-hidden />
                Ouvrir le tableau de bord
              </Link>
            ) : (
              <>
                <Link
                  href={SIGNUP_PATH}
                  data-lx={CTA_MARKER.mobile_menu}
                  data-lx-cta=""
                  onClick={() => {
                    trackFunnel("landing_primary_cta_click", { location: "mobile_menu" });
                    closeMenu();
                  }}
                  className="nl-menu-cta nl-focus"
                >
                  {PRIMARY_CTA_LABEL}
                </Link>
                <Link
                  href="/connexion"
                  onClick={() => {
                    track("cta_connexion", { source: "menu" });
                    closeMenu();
                  }}
                  className="nl-menu-login nl-focus"
                >
                  Se connecter
                </Link>
                <p className="nl-menu-reassure">1 logement gratuit · sans carte bancaire</p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
