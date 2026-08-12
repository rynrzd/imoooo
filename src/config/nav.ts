import {
  BarChart3,
  Building2,
  Camera,
  CreditCard,
  Ellipsis,
  FileText,
  Gauge,
  Hammer,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ScrollText,
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

/**
 * Navigation de la SIDEBAR (≥ 1024 px) : la navigation produit ci-dessus,
 * plus les deux écrans transverses ajoutés avec la navigation mobile.
 *
 * Pourquoi une liste séparée : `NAV_SECTIONS` est aussi rendu tel quel par
 * l'aperçu produit de la landing publique (`components/landing/product-preview`).
 * Y ajouter des entrées modifierait une page validée. La sidebar, elle, doit
 * rester complète — d'où cette composition, dérivée sans duplication.
 */
export const SIDEBAR_SECTIONS: NavSection[] = NAV_SECTIONS.map((section) =>
  section.label === "Patrimoine"
    ? { ...section, items: [...section.items, { title: "Baux", href: "/baux", icon: ScrollText }] }
    : section.label === "Gestion"
      ? {
          ...section,
          items: [
            ...section.items,
            { title: "Dépenses", href: "/depenses", icon: Receipt },
          ],
        }
      : section
);

/** Liste à plat (recherches, menu mobile…). */
export const MAIN_NAV: NavItem[] = SIDEBAR_SECTIONS.flatMap((s) => s.items);

/** Navigation secondaire (compte). */
export const ACCOUNT_NAV: NavItem[] = [
  { title: "Paramètres", href: "/parametres", icon: Settings },
  { title: "Abonnement", href: "/abonnement", icon: CreditCard },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

/* ------------------------------------------------------------------ */
/*  Navigation MOBILE                                                  */
/* ------------------------------------------------------------------ */

/**
 * Barre inférieure — exactement cinq entrées, dont « Plus ».
 *
 * C'est la navigation principale du téléphone : le pouce y accède sans
 * traverser l'écran, et l'entrée active se lit d'un coup d'œil. La sidebar
 * (≥ 1024 px) et son groupement par sections restent inchangés : la barre ne
 * les remplace pas, elle prend le relais là où elles n'existent pas.
 */
export const BOTTOM_NAV: NavItem[] = [
  { title: "Accueil", href: "/", icon: LayoutDashboard },
  { title: "Logements", href: "/logements", icon: Building2 },
  { title: "Loyers", href: "/loyers", icon: Wallet },
  { title: "Documents", href: "/documents", icon: FileText },
];

/** Icône de la cinquième entrée (ouvre la feuille « Plus »). */
export const MORE_ICON = Ellipsis;

/**
 * Tout le reste, dans la feuille « Plus ». L'ordre suit la fréquence d'usage
 * réelle : le quotidien d'abord, le compte ensuite.
 */
export const MORE_NAV: NavSection[] = [
  {
    label: "Gestion",
    items: [
      { title: "Locataires", href: "/locataires", icon: Users },
      { title: "Baux", href: "/baux", icon: ScrollText },
      { title: "Dépenses", href: "/depenses", icon: Receipt },
      { title: "Travaux", href: "/travaux", icon: Hammer },
      { title: "Photos", href: "/photos", icon: Camera },
    ],
  },
  {
    label: "Analyse",
    items: [
      { title: "Statistiques", href: "/statistiques", icon: BarChart3 },
      { title: "Pilotage", href: "/pilotage", icon: Gauge },
    ],
  },
  {
    label: "Compte",
    items: [
      { title: "Abonnement", href: "/abonnement", icon: CreditCard },
      { title: "Paramètres", href: "/parametres", icon: Settings },
      { title: "Aide", href: "/parametres?onglet=aide", icon: LifeBuoy },
    ],
  },
];
