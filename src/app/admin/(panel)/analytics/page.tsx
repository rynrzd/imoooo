import type { Metadata } from "next";
import { Database } from "lucide-react";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { getAnalyticsSnapshot } from "@/lib/analytics/queries";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

/**
 * Analytics — données RÉELLES (first-party Supabase, RGPD, sans service tiers).
 * L'accès est déjà verrouillé côté serveur par le layout du panneau
 * (requireAdminPage : session administrateur active vérifiée en base). Un
 * utilisateur normal est redirigé avant tout rendu, même par URL directe.
 */
export default async function AdminAnalyticsPage() {
  let initial = null;
  try {
    initial = await getAnalyticsSnapshot("7d");
  } catch (e) {
    logger.error("admin/analytics page", e);
  }

  if (!initial) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Statistiques de fréquentation et de conversion en temps réel.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <Database className="size-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Statistiques indisponibles</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              La table d&apos;analytics n&apos;est pas encore prête. Appliquez la migration{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                20260726090000_analytics.sql
              </code>{" "}
              dans Supabase, puis rechargez la page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <AnalyticsDashboard initial={initial} />;
}
