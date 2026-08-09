"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NidLogo } from "./nid-logo";

/**
 * En-tête de la vitrine Nireo ID.
 * Quatre entrées, deux actions. Nireo Immo n'apparaît pas ici : le lien
 * discret se trouve dans le pied de page (une seule promesse par page).
 */

const LINKS = [
  { href: "/id#fonctionnement", label: "Comment ça marche" },
  { href: "/id#entreprises", label: "Entreprises" },
  { href: "/id#reparateurs", label: "Réparateurs" },
  { href: "/id#tarifs", label: "Tarifs" },
];

const SIGNUP_HREF = "/inscription?next=%2Fid%2Fapp%2Fobjets%2Fnouveau";
const LOGIN_HREF = "/connexion?next=%2Fid%2Fapp";

export function NidPublicHeader() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <NidLogo />

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" render={<Link href={LOGIN_HREF} />}>
            Se connecter
          </Button>
          <Button render={<Link href={SIGNUP_HREF} />}>Ajouter mon téléphone</Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="nid-mobile-menu"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="grid size-11 place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted md:hidden"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <div id="nid-mobile-menu" className="border-t border-border bg-card md:hidden">
          <nav aria-label="Sections" className="mx-auto flex w-full max-w-6xl flex-col p-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                data-touch
                render={<Link href={LOGIN_HREF} onClick={() => setOpen(false)} />}
              >
                Se connecter
              </Button>
              <Button
                data-touch
                render={<Link href={SIGNUP_HREF} onClick={() => setOpen(false)} />}
              >
                Ajouter mon téléphone
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
