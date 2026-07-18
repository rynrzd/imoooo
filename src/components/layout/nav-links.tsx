"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  type NavItem,
  type NavSection,
} from "@/config/nav";

interface NavLinksProps {
  items: NavItem[];
  /** Callback appelé après un clic (fermeture du menu mobile). */
  onNavigate?: () => void;
}

/** Liste de liens de navigation avec état actif — partagée sidebar / mobile. */
export function NavLinks({ items, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isNavItemActive(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

interface NavSectionsProps {
  sections: NavSection[];
  onNavigate?: () => void;
}

/** Navigation principale groupée par sections libellées. */
export function NavSections({ sections, onNavigate }: NavSectionsProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section, index) => (
        <div key={section.label ?? index} className="flex flex-col gap-0.5">
          {section.label ? (
            <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isNavItemActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150",
        active
          ? "bg-accent font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
          : "font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <item.icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-foreground" : "text-muted-foreground/70"
        )}
      />
      {item.title}
    </Link>
  );
}
