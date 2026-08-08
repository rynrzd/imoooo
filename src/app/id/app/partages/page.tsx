import type { Metadata } from "next";
import Link from "next/link";
import { Link2, Link2Off } from "lucide-react";
import { ActionButton } from "@/components/nireo-id/action-button";
import { revokeShareAction } from "@/features/nireo-id/actions/owner";
import { SHARE_SECTION_LABELS } from "@/features/nireo-id/constants";
import { formatDateTime, formatRemaining } from "@/features/nireo-id/format";
import { isNireoIdConfigured, nidUserClient } from "@/features/nireo-id/server/client";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import type { ShareLinkRow } from "@/features/nireo-id/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Liens de partage",
  robots: { index: false, follow: false },
};

interface ShareWithAsset extends ShareLinkRow {
  asset: { id: string; public_id: string; brand: string; model: string } | null;
}

/**
 * Lecture ET répartition actifs / fermés au même endroit : l'horodatage
 * de référence est pris pendant le chargement des données, jamais pendant
 * le rendu du composant.
 */
async function loadShares(): Promise<{ active: ShareWithAsset[]; closed: ShareWithAsset[] }> {
  if (!isNireoIdConfigured) return { active: [], closed: [] };
  const supabase = await nidUserClient();
  const { data, error } = await supabase
    .from("nid_share_links")
    .select("*, asset:nid_assets (id, public_id, brand, model)")
    .order("created_at", { ascending: false });
  if (error) return { active: [], closed: [] };

  const rows = (data ?? []) as ShareWithAsset[];
  const readAt = Date.now();
  return {
    active: rows.filter(
      (share) => !share.revoked_at && new Date(share.expires_at).getTime() > readAt
    ),
    closed: rows.filter(
      (share) => share.revoked_at || new Date(share.expires_at).getTime() <= readAt
    ),
  };
}

export default async function SharesPage() {
  await requireNidSession("/id/app/partages");
  const { active, closed } = await loadShares();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Liens de partage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tous les dossiers que vous avez ouverts, sur l’ensemble de vos
          passeports. Un lien peut être coupé à tout moment.
        </p>
      </header>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="size-4 text-primary" aria-hidden />
          Liens actifs ({active.length})
        </h2>

        {active.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Aucun lien actif. Vos passeports ne sont consultables par personne
            en dehors de leur aperçu public minimal.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((share) => (
              <li key={share.id} className="nid-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {share.asset ? (
                        <Link
                          href={`/id/app/objets/${share.asset.id}?onglet=acces`}
                          className="underline-offset-2 hover:underline"
                        >
                          {share.asset.brand} {share.asset.model}
                        </Link>
                      ) : (
                        "Passeport"
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {share.label || "Lien sans nom"} · expire dans{" "}
                      {formatRemaining(share.expires_at)} · {share.access_count} consultation
                      {share.access_count > 1 ? "s" : ""}
                    </p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {share.sections.map((section) => (
                        <span
                          key={section}
                          className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {SHARE_SECTION_LABELS[section]}
                        </span>
                      ))}
                    </p>
                  </div>

                  <ActionButton
                    action={revokeShareAction}
                    fields={{ share_id: share.id, asset_id: share.asset?.id ?? "" }}
                    label="Révoquer"
                    pendingLabel="Révocation…"
                    successMessage="Lien révoqué."
                    confirmMessage="Révoquer ce lien ? Il cessera immédiatement de fonctionner."
                    icon={<Link2Off className="size-3.5" data-icon="inline-start" />}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-foreground">
            Liens fermés ({closed.length})
          </h2>
          <ul className="mt-3 space-y-1.5">
            {closed.map((share) => (
              <li
                key={share.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
              >
                <span>
                  {share.asset ? `${share.asset.brand} ${share.asset.model}` : "Passeport"} —{" "}
                  {share.label || "sans nom"}
                </span>
                <span>
                  {share.revoked_at
                    ? `Révoqué le ${formatDateTime(share.revoked_at)}`
                    : `Expiré le ${formatDateTime(share.expires_at)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
