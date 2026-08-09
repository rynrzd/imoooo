import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthBadge, SourceBadge } from "@/components/nireo-id/state-badge";
import { formatEventDate, formatRemaining } from "@/features/nireo-id/format";
import { getAssetDetail, listAssets } from "@/features/nireo-id/server/assets";
import { listPendingChecks } from "@/features/nireo-id/server/checkups";
import { NID_SCHEMA_MISSING, isNireoIdConfigured } from "@/features/nireo-id/server/client";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listRepairsAwaitingValidation } from "@/features/nireo-id/server/repairs";
import { listTransfers } from "@/features/nireo-id/server/transfers";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NireoIdHomePage() {
  const session = await requireNidSession("/id/app");

  const [assets, transfers, checks, repairs] = await Promise.all([
    listAssets(),
    listTransfers(session.email),
    listPendingChecks(session.user.id),
    listRepairsAwaitingValidation(session.user.id),
  ]);

  const incoming = transfers.received.filter((transfer) => transfer.status === "en_attente");
  const main = assets[0] ?? null;
  const detail = main ? await getAssetDetail(main.id) : null;
  const actionsCount = incoming.length + checks.length + repairs.length;

  /* ---------------- Écran vide ---------------- */
  if (assets.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-foreground">
          Ajoutez votre premier téléphone
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Conservez sa facture, suivez son état et retrouvez ses réparations.
        </p>
        <div className="mt-7">
          <Button size="lg" data-touch render={<Link href="/id/app/objets/nouveau" />}>
            Ajouter mon téléphone
            <ArrowRight className="size-4" data-icon="inline-end" />
          </Button>
        </div>
        {isNireoIdConfigured ? null : (
          <p className="nid-note mt-7 py-1 pl-4 text-sm">{NID_SCHEMA_MISSING}</p>
        )}

        <div className="nid-rule mt-12 pt-7">
          <h2 className="text-[17px] font-medium text-foreground">
            Vous gérez plusieurs téléphones ?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Créez un espace entreprise pour suivre un parc et affecter les téléphones à vos
            salariés, ou un espace atelier si vous réparez des appareils.
          </p>
          <div className="mt-4">
            <Button variant="outline" render={<Link href="/id/app/espaces/nouveau" />}>
              Créer un espace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Accueil avec téléphones ---------------- */
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mes téléphones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length === 1 ? "1 téléphone suivi." : `${assets.length} téléphones suivis.`}
          </p>
        </div>
        <Button data-touch render={<Link href="/id/app/objets/nouveau" />}>
          <Plus className="size-4" data-icon="inline-start" />
          Ajouter mon téléphone
        </Button>
      </header>

      {actionsCount > 0 ? (
        <section aria-labelledby="actions" className="nid-rule pt-7">
          <h2 id="actions" className="text-[17px] font-medium text-foreground">
            Actions demandées
          </h2>
          <ul className="mt-4">
            {checks.map((check) => (
              <li
                key={check.request_id}
                className="nid-rule flex flex-wrap items-center justify-between gap-3 py-3.5 first:border-0 first:pt-0"
              >
                <span className="text-[15px] text-foreground">
                  Bilan à faire pour votre {check.brand} {check.model}.
                </span>
                <Button size="sm" render={<Link href={`/id/app/objets/${check.asset_id}`} />}>
                  Ouvrir
                </Button>
              </li>
            ))}

            {repairs.map((repair) => (
              <li
                key={repair.id}
                className="nid-rule flex flex-wrap items-center justify-between gap-3 py-3.5 first:border-0 first:pt-0"
              >
                <span className="text-[15px] text-foreground">
                  {repair.repairer_label || "Un atelier"} attend votre validation pour le{" "}
                  {repair.device}.
                </span>
                <Button size="sm" render={<Link href={`/id/app/objets/${repair.asset_id}`} />}>
                  Vérifier
                </Button>
              </li>
            ))}

            {incoming.map((transfer) => (
              <li
                key={transfer.id}
                className="nid-rule flex flex-wrap items-center justify-between gap-3 py-3.5 first:border-0 first:pt-0"
              >
                <span className="text-[15px] text-foreground">
                  Un {transfer.asset_summary.brand} {transfer.asset_summary.model} vous est
                  transmis — expire dans {formatRemaining(transfer.expires_at)}.
                </span>
                <Button size="sm" render={<Link href="/id/app/transferts" />}>
                  Examiner
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {main ? (
        <section aria-labelledby="principal" className="nid-rule pt-7">
          <h2 id="principal" className="sr-only">
            Téléphone principal
          </h2>
          <div className="flex items-start gap-4">
            {main.photo_url ? (
              <Image
                src={main.photo_url}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-16 shrink-0 rounded-md border border-border object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-medium text-foreground">
                {main.brand} {main.model}
              </p>
              <p className="mt-1 text-sm text-foreground">
                <HealthBadge state={main.health_state} />
                <span className="ml-2 text-muted-foreground">
                  {main.next_check_on
                    ? main.check_overdue
                      ? `bilan en retard depuis le ${formatDate(main.next_check_on)}`
                      : `prochain bilan le ${formatDate(main.next_check_on)}`
                    : "aucun bilan planifié"}
                </span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{main.public_id}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" render={<Link href={`/id/app/objets/${main.id}`} />}>
              Voir mon téléphone
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/id/app/objets/${main.id}#bilan`} />}
            >
              Faire le bilan
            </Button>
          </div>
        </section>
      ) : null}

      {detail && detail.events.length > 0 ? (
        <section aria-labelledby="derniers" className="nid-rule pt-7">
          <h2 id="derniers" className="text-[17px] font-medium text-foreground">
            Derniers événements
          </h2>
          <ul className="mt-4">
            {detail.events.slice(0, 5).map((event) => (
              <li
                key={event.id}
                className="nid-rule flex flex-wrap items-center gap-2 py-3 text-[15px] first:border-0 first:pt-0"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">{event.title}</span>
                <SourceBadge
                  source={(event as { source_type?: string }).source_type ?? "declare_proprietaire"}
                />
                <span className="text-xs text-muted-foreground">
                  {formatEventDate(event.effective_date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {assets.length > 1 ? (
        <p>
          <Link
            href="/id/app/telephones"
            className="text-sm text-primary underline underline-offset-2"
          >
            Voir mes {assets.length} téléphones
          </Link>
        </p>
      ) : null}
    </div>
  );
}
