import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Inbox, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/nireo-id/state-badge";
import { formatEventDate, formatRemaining } from "@/features/nireo-id/format";
import { getAssetDetail, listAssets } from "@/features/nireo-id/server/assets";
import { listPendingChecks } from "@/features/nireo-id/server/checkups";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listRepairsAwaitingValidation } from "@/features/nireo-id/server/repairs";
import { listTransfers } from "@/features/nireo-id/server/transfers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activité" };

/** Journal simple : ce qui attend une action, puis les derniers événements. */
export default async function NireoIdActivityPage() {
  const session = await requireNidSession("/id/app/activite");

  const [assets, transfers, checks, repairs] = await Promise.all([
    listAssets(),
    listTransfers(session.email),
    listPendingChecks(session.user.id),
    listRepairsAwaitingValidation(session.user.id),
  ]);

  const incoming = transfers.received.filter((transfer) => transfer.status === "en_attente");

  // Historique récent, tous téléphones confondus.
  const details = await Promise.all(assets.slice(0, 5).map((asset) => getAssetDetail(asset.id)));
  const recent = details
    .flatMap((detail) =>
      (detail?.events ?? []).map((event) => ({
        id: event.id,
        assetId: detail?.asset.id ?? "",
        device: detail ? `${detail.asset.brand} ${detail.asset.model}` : "",
        title: event.title,
        date: event.effective_date,
        source: (event as { source_type?: string }).source_type ?? "declare_proprietaire",
      }))
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20);

  const pending = checks.length + repairs.length + incoming.length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Activité</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending === 0
            ? "Rien n’attend d’action de votre part."
            : `${pending} élément${pending > 1 ? "s" : ""} attend${pending > 1 ? "ent" : ""} une action.`}
        </p>
      </header>

      {pending > 0 ? (
        <section className="nid-panel rounded-lg p-5">
          <h2 className="font-medium text-foreground">À traiter</h2>
          <ul className="mt-3 space-y-2">
            {checks.map((check) => (
              <li
                key={check.request_id}
                className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4 text-sm"
              >
                <span className="flex items-center gap-3 text-foreground">
                  <ClipboardCheck className="size-4 shrink-0 text-accent-foreground" aria-hidden />
                  Bilan à faire — {check.brand} {check.model}
                </span>
                <Button size="sm" render={<Link href={`/id/app/objets/${check.asset_id}`} />}>
                  Ouvrir
                </Button>
              </li>
            ))}
            {repairs.map((repair) => (
              <li
                key={repair.id}
                className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4 text-sm"
              >
                <span className="flex items-center gap-3 text-foreground">
                  <Wrench className="size-4 shrink-0 text-accent-foreground" aria-hidden />
                  Réparation à valider — {repair.device}
                </span>
                <Button size="sm" render={<Link href={`/id/app/objets/${repair.asset_id}`} />}>
                  Vérifier
                </Button>
              </li>
            ))}
            {incoming.map((transfer) => (
              <li
                key={transfer.id}
                className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary py-2.5 pl-4 text-sm"
              >
                <span className="flex items-center gap-3 text-foreground">
                  <Inbox className="size-4 shrink-0 text-accent-foreground" aria-hidden />
                  Transfert reçu — expire dans {formatRemaining(transfer.expires_at)}
                </span>
                <Button size="sm" render={<Link href="/id/app/transferts" />}>
                  Examiner
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">Derniers événements</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun événement enregistré pour le moment.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {recent.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <Link
                  href={`/id/app/objets/${event.assetId}`}
                  className="min-w-0 flex-1 truncate text-foreground underline-offset-2 hover:underline"
                >
                  {event.title}
                  <span className="text-muted-foreground"> · {event.device}</span>
                </Link>
                <SourceBadge source={event.source} />
                <span className="text-xs text-muted-foreground">{formatEventDate(event.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p>
        <Link href="/id/app/transferts" className="text-sm text-primary underline underline-offset-2">
          Voir tous les transferts
        </Link>
      </p>
    </div>
  );
}
