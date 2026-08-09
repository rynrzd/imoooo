"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CreditCard,
  Home,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navigation de l'espace personnel Nireo ID.
 * Ordinateur : Accueil · Mes téléphones · Partages · Paramètres.
 * Mobile : Accueil · Téléphones · Activité · Profil (cibles ≥ 44 px).
 */

export interface NavCounts {
  transfers: number;
  shares: number;
  checks: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function desktopItems(counts: NavCounts): NavItem[] {
  return [
    { href: "/id/app", label: "Accueil", icon: Home, exact: true },
    { href: "/id/app/telephones", label: "Mes téléphones", icon: Smartphone },
    { href: "/id/app/partages", label: "Partages", icon: Share2, badge: counts.shares },
    { href: "/id/app/parametres", label: "Paramètres", icon: Settings },
  ];
}

function mobileItems(counts: NavCounts): NavItem[] {
  return [
    { href: "/id/app", label: "Accueil", icon: Home, exact: true },
    { href: "/id/app/telephones", label: "Téléphones", icon: Smartphone },
    {
      href: "/id/app/activite",
      label: "Activité",
      icon: Activity,
      badge: counts.transfers + counts.checks,
    },
    { href: "/id/app/parametres", label: "Profil", icon: User },
  ];
}

function secondaryItems(counts: NavCounts): NavItem[] {
  return [
    {
      href: "/id/app/activite",
      label: "Activité et transferts",
      icon: Activity,
      badge: counts.transfers + counts.checks,
    },
    { href: "/id/app/abonnement", label: "Abonnement", icon: CreditCard },
    { href: "/id/pro", label: "Espace atelier", icon: Wrench },
  ];
}

export function NidSidebar({ counts, isAdmin }: { counts: NavCounts; isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation Nireo ID" className="flex flex-col gap-1">
      {desktopItems(counts).map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      <p className="mt-5 px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Accès
      </p>
      {secondaryItems(counts).map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
      ))}
      {isAdmin ? (
        <NavLink
          item={{ href: "/id/admin", label: "Administration", icon: ShieldCheck }}
          active={isActive(pathname, { href: "/id/admin", label: "", icon: ShieldCheck })}
        />
      ) : null}
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function NidBottomNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation Nireo ID"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {mobileItems(counts).map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                  active ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {item.badge ? (
                    <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-primary px-1 text-[9px] leading-4 font-semibold text-primary-foreground tabular-nums">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
