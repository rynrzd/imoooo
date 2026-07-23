"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Crown,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/** Navigation de l'espace d'administration — totalement distincte de l'app. */
export const ADMIN_NAV: AdminNavItem[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { title: "Utilisateurs", href: "/admin/utilisateurs", icon: Users },
  { title: "Abonnements", href: "/admin/abonnements", icon: CreditCard },
  { title: "Codes promo", href: "/admin/codes-promo", icon: BadgePercent },
  { title: "Fondateurs", href: "/admin/fondateurs", icon: Crown },
  { title: "Transactions", href: "/admin/transactions", icon: Receipt },
  { title: "Support", href: "/admin/support", icon: LifeBuoy },
  { title: "Paramètres", href: "/admin/parametres", icon: Settings },
  { title: "Audit", href: "/admin/audit", icon: ScrollText },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Liste verticale (sidebar desktop). */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className={cn("size-4", active ? "text-primary" : "")} />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

/** Rangée horizontale défilable (mobile). */
export function AdminNavMobile() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
              active
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-3.5" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
