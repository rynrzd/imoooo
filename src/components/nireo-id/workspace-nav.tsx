"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  Smartphone,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { FLEET_READ_ROLES, MANAGING_ROLES, type WorkspaceRole } from "@/features/nireo-id/constants";
import { cn } from "@/lib/utils";

/**
 * Navigation d'un espace entreprise.
 * Les entrées masquées pour un rôle ne sont pas seulement cachées :
 * chaque page revérifie le rôle côté serveur, et la RLS s'applique.
 */

interface Item {
  segment: string;
  label: string;
  icon: LucideIcon;
  roles: WorkspaceRole[];
}

const ITEMS: Item[] = [
  { segment: "", label: "Vue d’ensemble", icon: LayoutDashboard, roles: FLEET_READ_ROLES },
  { segment: "/parc", label: "Parc", icon: Smartphone, roles: FLEET_READ_ROLES },
  { segment: "/affectations", label: "Affectations", icon: Users, roles: FLEET_READ_ROLES },
  { segment: "/bilans", label: "Bilans", icon: ClipboardCheck, roles: FLEET_READ_ROLES },
  { segment: "/reparations", label: "Réparations", icon: Wrench, roles: FLEET_READ_ROLES },
  { segment: "/collaborateurs", label: "Collaborateurs", icon: UserCog, roles: ["owner", "admin"] },
  { segment: "/rapports", label: "Rapports", icon: BarChart3, roles: MANAGING_ROLES },
];

export function WorkspaceNav({
  workspaceId,
  role,
  orientation = "vertical",
}: {
  workspaceId: string;
  role: WorkspaceRole;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const base = `/id/entreprise/${workspaceId}`;
  const items = ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav
      aria-label="Navigation de l’entreprise"
      className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-row")}
    >
      {items.map((item) => {
        const href = `${base}${item.segment}`;
        const active = item.segment === "" ? pathname === href : pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
