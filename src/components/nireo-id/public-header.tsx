"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NidLogo } from "./nid-logo";

const LINKS = [
  { href: "/id#fonctionnement", label: "Fonctionnement" },
  { href: "/id#professionnels", label: "Pour les réparateurs" },
  { href: "/id#confiance", label: "Confiance" },
  { href: "/id#faq", label: "FAQ" },
];

/** Destination d'inscription : le visiteur revient créer son passeport. */
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
    <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur">
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
          <Button variant="ghost" size="lg" render={<Link href={LOGIN_HREF} />}>
            Se connecter
          </Button>
          <Button size="lg" render={<Link href={SIGNUP_HREF} />}>
            Créer un Nireo ID
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="nid-mobile-menu"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="grid size-11 place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
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
                size="lg"
                data-touch
                render={<Link href={LOGIN_HREF} onClick={() => setOpen(false)} />}
              >
                Se connecter
              </Button>
              <Button
                size="lg"
                data-touch
                render={<Link href={SIGNUP_HREF} onClick={() => setOpen(false)} />}
              >
                Créer un Nireo ID
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
