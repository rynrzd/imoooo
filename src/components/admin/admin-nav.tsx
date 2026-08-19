"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Building2,
  ChartColumn,
  Crown,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  Share2,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Navigation de l'espace d'administration.
 *
 * Quinze destinations, groupées en QUATRE familles qui répondent chacune à
 * une question : que se passe-t-il, qui sont les clients, d'où viennent-ils,
 * comment Nireo est-il réglé. Une liste plate de quinze entrées est
 * illisible dès qu'on la met dans 390 px.
 *
 * Sur mobile, la navigation est un PANNEAU, jamais une rangée qui défile
 * horizontalement : l'ancienne version poussait treize pastilles hors de
 * l'écran, et rien n'indiquait qu'il restait des entrées à droite.
 */

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: ChartColumn },
    ],
  },
  {
    label: "Clients",
    items: [
      { title: "Utilisateurs", href: "/admin/utilisateurs", icon: Users },
      { title: "Abonnements", href: "/admin/abonnements", icon: CreditCard },
      { title: "Fondateurs", href: "/admin/fondateurs", icon: Crown },
      { title: "Transactions", href: "/admin/transactions", icon: Receipt },
      { title: "Support", href: "/admin/support", icon: LifeBuoy },
    ],
  },
  {
    label: "Croissance",
    items: [
      { title: "Marketing", href: "/admin/marketing", icon: Megaphone },
      { title: "Affiliation", href: "/admin/marketing/partenaires", icon: Share2 },
      { title: "Codes promo", href: "/admin/codes-promo", icon: BadgePercent },
      { title: "Emails", href: "/admin/emails", icon: Mail },
      { title: "Automatisations", href: "/admin/automatisations", icon: Workflow },
    ],
  },
  {
    label: "Réglages",
    items: [
      { title: "Entreprise", href: "/admin/entreprise", icon: Building2 },
      { title: "Paramètres", href: "/admin/parametres", icon: Settings },
      { title: "Journal", href: "/admin/audit", icon: ScrollText },
    ],
  },
];

/** Toutes les destinations, à plat — pour retrouver la page courante. */
const ALL_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

/**
 * La destination active est la plus SPÉCIFIQUE qui préfixe le chemin.
 *
 * Sans cette règle, « Marketing » (/admin/marketing) et « Affiliation »
 * (/admin/marketing/partenaires) s'allumeraient toutes les deux sur la fiche
 * d'un partenaire — deux entrées actives, aucune information.
 */
export function activeAdminHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ALL_ITEMS) {
    const matches =
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}

/** Titre de la page courante — repris par l'en-tête mobile. */
export function activeAdminTitle(pathname: string): string {
  const href = activeAdminHref(pathname);
  return ALL_ITEMS.find((item) => item.href === href)?.title ?? "Administration";
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/admin-nav relative flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
        "[transition-property:color,background-color] [transition-duration:var(--mo-micro)] [transition-timing-function:var(--mo-ease)] motion-reduce:transition-none",
        active
          ? "bg-accent font-medium text-foreground"
          : "font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {/* Le même repère que la barre latérale de l'application : un filet qui
          se déploie, pas une pastille de couleur. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 origin-center rounded-full bg-primary",
          "[transition-property:opacity,transform] [transition-duration:var(--mo-component)] [transition-timing-function:var(--mo-ease)] motion-reduce:transition-none",
          active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
        )}
      />
      <item.icon
        className={cn(
          "size-4 shrink-0 [transition-property:color,transform] [transition-duration:var(--mo-micro)] [transition-timing-function:var(--mo-ease)] motion-reduce:transition-none",
          "group-hover/admin-nav:translate-x-0.5",
          active ? "text-primary" : "text-muted-foreground/70"
        )}
      />
      {item.title}
    </Link>
  );
}

/** Liste groupée — barre latérale de bureau et panneau mobile. */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeAdminHref(pathname);

  return (
    <nav className="flex flex-col gap-5" aria-label="Navigation de l'administration">
      {ADMIN_NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={item.href === active}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * Déclencheur mobile — ouvre le panneau. Le panneau se ferme dès qu'une
 * destination est choisie : sans cela il resterait ouvert par-dessus la page
 * qu'on vient de demander.
 */
export function AdminNavMobile() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const title = activeAdminTitle(pathname);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Ouvrir la navigation" />
        }
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-[17rem] gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm">Administration</SheetTitle>
          <p className="text-xs text-muted-foreground">{title}</p>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-6">
          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
