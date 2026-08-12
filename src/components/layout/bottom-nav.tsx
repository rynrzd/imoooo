"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BOTTOM_NAV, MORE_ICON, MORE_NAV, isNavItemActive } from "@/config/nav";
import { cn } from "@/lib/utils";

/**
 * Navigation principale du TÉLÉPHONE — barre fixe en bas, cinq entrées.
 *
 * Elle remplace le menu hamburger pour tout ce qui est quotidien : quatre
 * destinations atteignables au pouce, et « Plus » pour le reste. Au-dessus de
 * 1024 px elle disparaît au profit de la sidebar, inchangée.
 *
 * Points de sécurité d'usage :
 * - chaque cible fait au moins 44 px de haut (`min-h-14` + libellé) ;
 * - la barre réserve la zone gestuelle iPhone (`env(safe-area-inset-bottom)`)
 *   et le layout applicatif réserve sa hauteur en bas de page, donc elle ne
 *   recouvre jamais le contenu (cf. `--nireo-bottom-nav-h`) ;
 * - l'entrée active est portée par la couleur ET le poids du texte, jamais par
 *   la couleur seule.
 */

/** Hauteur de la barre, hors marge de sécurité — partagée avec le layout. */
export const BOTTOM_NAV_HEIGHT = "3.5rem";

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Une entrée de la feuille « Plus » est ouverte : le bouton « Plus » doit le
  // montrer, sinon la barre semble ne plus correspondre à l'écran affiché.
  const moreActive = MORE_NAV.some((section) =>
    section.items.some((item) => isNavItemActive(pathname, item.href))
  );

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {BOTTOM_NAV.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] transition-colors",
                    active
                      ? "font-semibold text-primary"
                      : "font-normal text-muted-foreground"
                  )}
                >
                  <item.icon className="size-5 shrink-0" aria-hidden />
                  {item.title}
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] transition-colors",
                moreActive || moreOpen
                  ? "font-semibold text-primary"
                  : "font-normal text-muted-foreground"
              )}
            >
              <MORE_ICON className="size-5 shrink-0" aria-hidden />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Plus</SheetTitle>
          </SheetHeader>
          <div
            className="flex flex-col gap-5 px-4 py-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {MORE_NAV.map((section) => (
              <div key={section.label ?? "principal"}>
                {section.label ? (
                  <p className="mb-1 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {section.label}
                  </p>
                ) : null}
                <ul>
                  {section.items.map((item) => {
                    const active = isNavItemActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm transition-colors",
                            active
                              ? "bg-accent font-medium text-foreground"
                              : "text-foreground hover:bg-accent/60"
                          )}
                        >
                          <item.icon
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
