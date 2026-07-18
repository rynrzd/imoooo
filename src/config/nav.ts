import {
  BarChart3,
  Building2,
  Camera,
  CreditCard,
  FileText,
  Gauge,
  Hammer,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  /** Libellé de section affiché en petites capitales (null = sans titre). */
  label: string | null;
  items: NavItem[];
}

/** Navigation principale, groupée par usage produit. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { title: "Tableau de bord", href: "/", icon: LayoutDashboard },
      { title: "Pilotage", href: "/pilotage", icon: Gauge },
      { title: "Statistiques", href: "/statistiques", icon: BarChart3 },
    ],
  },
  {
    label: "Patrimoine",
    items: [
      { title: "Logements", href: "/logements", icon: Building2 },
      { title: "Locataires", href: "/locataires", icon: Users },
      { title: "Loyers", href: "/loyers", icon: Wallet },
    ],
  },
  {
    label: "Gestion",
    items: [
      { title: "Documents", href: "/documents", icon: FileText },
      { title: "Photos", href: "/photos", icon: Camera },
      { title: "Travaux", href: "/travaux", icon: Hammer },
    ],
  },
];

/** Liste à plat (recherches, menu mobile…). */
export const MAIN_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Navigation secondaire (compte). */
export const ACCOUNT_NAV: NavItem[] = [
  { title: "Paramètres", href: "/parametres", icon: Settings },
  { title: "Abonnement", href: "/abonnement", icon: CreditCard },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
