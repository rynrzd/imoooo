import Link from "next/link";
import { ArrowRight, Inbox, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetList } from "@/components/nireo-id/asset-list";
import { formatRemaining } from "@/features/nireo-id/format";
import { listAssets } from "@/features/nireo-id/server/assets";
import { NID_SCHEMA_MISSING, isNireoIdConfigured } from "@/features/nireo-id/server/client";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listTransfers } from "@/features/nireo-id/server/transfers";

export const dynamic = "force-dynamic";

export default async function NireoIdDashboardPage() {
  const session = await requireNidSession("/id/app");
  const [assets, transfers] = await Promise.all([
    listAssets(),
    listTransfers(session.email),
  ]);

  const incoming = transfers.received.filter((transfer) => transfer.status === "en_attente");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mes smartphones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length === 0
              ? "Aucun passeport pour le moment."
              : assets.length === 1
                ? "1 passeport enregistré."
                : `${assets.length} passeports enregistrés.`}
          </p>
        </div>
        <Button data-touch render={<Link href="/id/app/objets/nouveau" />}>
          <Plus className="size-4" data-icon="inline-start" />
          Ajouter un smartphone
        </Button>
      </header>

      {incoming.length > 0 ? (
        <section aria-labelledby="transferts-recus">
          <h2 id="transferts-recus" className="sr-only">
            Transferts en attente
          </h2>
          <ul className="space-y-2">
            {incoming.map((transfer) => (
              <li
                key={transfer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <Inbox className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm text-foreground">
                    Un{" "}
                    <strong>
                      {transfer.asset_summary.brand} {transfer.asset_summary.model}
                    </strong>{" "}
                    vous est transmis — expire dans {formatRemaining(transfer.expires_at)}.
                  </span>
                </span>
                <Button size="sm" render={<Link href="/id/app/transferts" />}>
                  Examiner
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {assets.length === 0 ? (
        <section className="nid-panel nid-topline rounded-2xl px-6 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Smartphone className="size-7" aria-hidden />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-foreground">
            Créez le passeport de votre premier smartphone
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Quelques minutes suffisent : marque, modèle et une photo. Vous
            pourrez ajouter la facture, l’état et les réparations quand vous
            voulez.
          </p>
          <div className="mt-6">
            <Button size="lg" data-touch render={<Link href="/id/app/objets/nouveau" />}>
              Ajouter un smartphone
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          </div>
          {!isNireoIdConfigured ? null : (
            <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">
              Si vous venez d’installer Nireo ID et que rien ne s’enregistre :{" "}
              {NID_SCHEMA_MISSING}
            </p>
          )}
        </section>
      ) : (
        <AssetList items={assets} />
      )}
    </div>
  );
}
