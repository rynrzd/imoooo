"use client";

import { usePathname } from "next/navigation";
import { activeAdminTitle } from "@/components/admin/admin-nav";

/**
 * Titre de la page courante, pour l'en-tête mobile.
 *
 * Il vient de la MÊME table que la navigation (`ADMIN_NAV`) : une page
 * renommée dans la navigation l'est ici aussi, sans second endroit à tenir
 * à jour.
 */
export function AdminPageTitle() {
  const pathname = usePathname();
  return (
    <span className="min-w-0 truncate text-sm font-semibold">
      {activeAdminTitle(pathname)}
    </span>
  );
}
