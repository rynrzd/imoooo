import type { Metadata } from "next";
import { Database } from "lucide-react";
import { LandingIntelligence } from "@/components/admin/landing-intelligence";
import { getLandingSnapshot } from "@/lib/landing/queries";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Landing Intelligence" };
export const dynamic = "force-dynamic";

/**
 * Landing Intelligence — centre de pilotage de la vitrine.
 *
 * Toutes les valeurs affichées viennent des tables `landing_*` : sessions
 * réellement observées, conversions confirmées côté serveur, variantes
 * réellement servies. Aucune donnée simulée, aucun score fabriqué.
 *
 * L'accès est verrouillé par le layout du panneau (`requireAdminPage`).
 */
export default async function AdminLandingPage() {
  let initial = null;
  try {
    initial = await getLandingSnapshot("7d");
  } catch (e) {
    logger.error("admin/landing page", e);
  }

  if (!initial?.ready) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Landing Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personnalisation, expérimentation et optimisation continue de la vitrine.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <Database className="size-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Moteur non initialisé</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Appliquez la migration{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                20260801090000_landing_intelligence.sql
              </code>{" "}
              dans Supabase, puis rechargez la page. En attendant, la vitrine
              affiche sa version de référence : rien n&apos;est cassé, rien n&apos;est mesuré.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <LandingIntelligence initial={initial} />;
}
