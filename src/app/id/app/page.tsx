import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ClipboardCheck, Inbox, Plus, Smartphone, Wrench } from "lucide-react";
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
      <div className="space-y-6">
        <section className="nid-panel rounded-2xl px-6 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Smartphone className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-foreground">
            Ajoutez votre premier téléphone
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Conservez sa facture, suivez son état et retrouvez ses réparations.
          </p>
          <div className="mt-6">
            <Button size="lg" data-touch render={<Link href="/id/app/objets/nouveau" />}>
              Ajouter mon téléphone
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          </div>
          {isNireoIdConfigured ? null : (
            <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">
              {NID_SCHEMA_MISSING}
            </p>
          )}
        </section>

        <section className="nid-panel rounded-2xl p-5">
          <h2 className="font-medium text-foreground">Vous gérez plusieurs téléphones ?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Créez un espace entreprise pour suivre un parc et affecter les téléphones à vos
            salariés, ou un espace atelier si vous réparez des appareils.
          </p>
          <div className="mt-4">
            <Button variant="outline" render={<Link href="/id/app/espaces/nouveau" />}>
              Créer un espace
            </Button>
          </div>
        </section>
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
        <section aria-labelledby="actions" className="nid-panel rounded-2xl p-5">
          <h2 id="actions" className="font-medium text-foreground">
            Actions demandées
          </h2>
          <ul className="mt-3 space-y-2">
            {checks.map((check) => (
              <li
                key={check.request_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm text-foreground">
                  <ClipboardCheck className="size-4 shrink-0 text-accent-foreground" aria-hidden />
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm text-foreground">
                  <Wrench className="size-4 shrink-0 text-accent-foreground" aria-hidden />
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm text-foreground">
                  <Inbox className="size-4 shrink-0 text-accent-foreground" aria-hidden />
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
        <section aria-labelledby="principal" className="nid-panel rounded-2xl p-5">
          <h2 id="principal" className="sr-only">
            téléphone principal
          </h2>
          <div className="flex items-start gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-secondary">
              {main.photo_url ? (
                <Image
                  src={main.photo_url}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <Smartphone className="size-6 text-muted-foreground" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-foreground">
                {main.brand} {main.model}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{main.public_id}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <HealthBadge state={main.health_state} />
                <span className="text-xs text-muted-foreground">
                  {main.next_check_on
                    ? main.check_overdue
                      ? `Bilan en retard depuis le ${formatDate(main.next_check_on)}`
                      : `Prochain bilan le ${formatDate(main.next_check_on)}`
                    : "Aucun bilan planifié"}
                </span>
              </div>
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
        <section aria-labelledby="derniers" className="nid-panel rounded-2xl p-5">
          <h2 id="derniers" className="font-medium text-foreground">
            Derniers événements
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {detail.events.slice(0, 5).map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
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
