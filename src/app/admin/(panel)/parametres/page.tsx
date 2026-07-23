import type { Metadata } from "next";
import Link from "next/link";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import {
  setMaintenanceMode,
  setSupportEmail,
  updateAnnouncement,
} from "@/lib/admin/actions/settings";
import { getSiteSettings } from "@/lib/admin/settings";

export const metadata: Metadata = { title: "Paramètres du site" };
export const dynamic = "force-dynamic";

/** /admin/parametres — configuration du site (table site_settings). */
export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Paramètres du site</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Réglages appliqués en direct, sans modifier le code. Chaque modification est
          journalisée dans l&apos;audit.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <SiteSettingsForm
          announcement={settings.announcement_message}
          maintenance={settings.maintenance_mode}
          supportEmail={settings.support_email}
          onAnnouncement={updateAnnouncement}
          onMaintenance={setMaintenanceMode}
          onSupportEmail={setSupportEmail}
        />
      </div>

      <div className="max-w-2xl rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Offre Fondateur</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          L&apos;activation et le nombre de places se gèrent depuis{" "}
          <Link href="/admin/fondateurs" className="underline underline-offset-2 hover:text-foreground">
            la page Fondateurs
          </Link>
          .
        </p>
      </div>

      <div className="max-w-2xl rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Ce qui ne se règle PAS ici</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Les clés Stripe, Supabase et les secrets serveur : uniquement dans les variables
            d&apos;environnement (jamais modifiables depuis l&apos;admin).
          </li>
          <li>
            Les prix et limites des plans : définis dans <code>src/config/plans.ts</code> et
            appliqués aussi par la base — les modifier exige un déploiement, pour rester
            cohérent avec Stripe et les quotas.
          </li>
        </ul>
      </div>
    </div>
  );
}
