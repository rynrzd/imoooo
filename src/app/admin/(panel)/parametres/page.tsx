import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPromoForm } from "@/components/admin/marketing-promo-form";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import {
  setMaintenanceMode,
  setMarketingPromo,
  setSupportEmail,
  updateAnnouncement,
} from "@/lib/admin/actions/settings";
import { getSiteSettings } from "@/lib/admin/settings";
import { isEmailConfigured } from "@/lib/email/provider";
import { isRefCookieSigned } from "@/lib/marketing/referral";
import { isSharedRateLimitAvailable } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Paramètres du site" };
export const dynamic = "force-dynamic";

/** Une protection serveur et son état réel — jamais un état supposé. */
function ServerCheck({
  label,
  ok,
  okText,
  koText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  koText: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
      <dt className="text-sm">{label}</dt>
      <dd
        className={
          ok
            ? "text-xs text-emerald-700 dark:text-emerald-400"
            : "text-xs text-destructive"
        }
      >
        {ok ? okText : koText}
      </dd>
    </div>
  );
}

/** /admin/parametres — configuration du site (table site_settings). */
export default async function AdminSettingsPage() {
  const [settings, sharedRateLimit] = await Promise.all([
    getSiteSettings(),
    isSharedRateLimitAvailable(),
  ]);
  const emailSender =
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    process.env.EMAIL_FROM?.replace(/^.*<|>$/g, "").trim() ||
    "";

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
        <MarketingPromoForm initial={settings.marketing_promo} action={setMarketingPromo} />
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

      {/* Trois protections qui vivent dans les variables d'environnement, donc
          invisibles depuis l'interface. Leur point commun : elles échouent en
          SILENCE. Un expéditeur refusé, un secret absent ou une migration non
          appliquée ne provoquent aucune erreur visible — simplement rien. */}
      <div className="max-w-2xl rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">État du serveur</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lu en direct côté serveur. Ces réglages se changent dans les variables
          d&apos;environnement, jamais ici.
        </p>
        <dl className="mt-3 divide-y divide-border/60">
          <ServerCheck
            label="Envoi d’e-mails"
            ok={isEmailConfigured}
            okText={emailSender ? `expéditeur ${emailSender}` : "fournisseur configuré"}
            koText="aucun fournisseur : tout envoi échoue"
          />
          <ServerCheck
            label="Signature du cookie d’affiliation"
            ok={isRefCookieSigned}
            okText="active"
            koText="inactive — définissez REF_COOKIE_SECRET"
          />
          <ServerCheck
            label="Compteur de tentatives partagé"
            ok={sharedRateLimit}
            okText="actif sur toutes les instances"
            koText="repli mémoire — migration 20260819090000 non appliquée"
          />
        </dl>
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
