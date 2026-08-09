import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarPlus,
  Check,
  ClipboardCheck,
  FileText,
  Minus,
  Pencil,
  QrCode,
  Share2,
  Smartphone,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessManager } from "@/components/nireo-id/access-manager";
import { CheckupPanel } from "@/components/nireo-id/checkup-panel";
import { DocumentManager } from "@/components/nireo-id/document-manager";
import { EventActions } from "@/components/nireo-id/event-actions";
import { RepairPanel } from "@/components/nireo-id/repair-panel";
import { HealthBadge, SourceBadge } from "@/components/nireo-id/state-badge";
import {
  ASSET_STATUS_LABELS,
  CHECK_ANSWER_SHORT,
  CONDITION_GRADE_LABELS,
  CONDITION_POINTS,
  EVENT_TYPE_LABELS,
  PURCHASE_CONDITION_LABELS,
  type ConditionGrade,
  type HealthState,
} from "@/features/nireo-id/constants";
import {
  formatEventDate,
  formatMoneyFromCents,
  formatShortDate,
  maskIdentifier,
} from "@/features/nireo-id/format";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { getSchedule, listCheckups } from "@/features/nireo-id/server/checkups";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listRepairsForAsset } from "@/features/nireo-id/server/repairs";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon téléphone",
  robots: { index: false, follow: false },
};

const TABS = [
  { key: "apercu", label: "Résumé" },
  { key: "historique", label: "Historique" },
  { key: "documents", label: "Documents" },
  { key: "acces", label: "Partage" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function PassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { id } = await params;
  const { onglet } = await searchParams;
  await requireNidSession(`/id/app/objets/${id}`);

  const detail = await getAssetDetail(id);
  // Inexistant OU appartenant à quelqu'un d'autre : même réponse, aucune
  // information ne filtre sur l'existence du téléphone.
  if (!detail) notFound();

  const [schedule, checkups, repairs] = await Promise.all([
    getSchedule(id),
    listCheckups(id),
    listRepairsForAsset(id),
  ]);

  const tab: TabKey = TABS.some((item) => item.key === onglet) ? (onglet as TabKey) : "apercu";
  const { asset, events, documents, media, pro_access, completeness } = detail;
  const canEdit = asset.status !== "archived";
  const conditionPhotos = media.filter((item) => item.kind !== "principale");

  const condition = asset.declared_condition ?? {};
  const conditionEntries = CONDITION_POINTS.map((point) => ({
    label: point.label,
    grade: condition[point.key] as ConditionGrade | undefined,
  })).filter((entry) => entry.grade);

  const lastProfessionalEvent = events.find(
    (event) => event.trust_level === 2 && !event.revoked_at
  );
  const warrantyEvent = events.find((event) => event.type === "garantie" && !event.revoked_at);

  const assetV2 = asset as typeof asset & {
    health_state?: HealthState;
    warranty_end?: string | null;
  };
  const healthState: HealthState = assetV2.health_state ?? "bon_etat";
  const warrantyEnd = assetV2.warranty_end ?? null;
  const lastCheckup = checkups[0] ?? null;

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link
          href="/id/app/telephones"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Mes téléphones
        </Link>
      </p>

      {/* ------------------------------------------------------------ */}
      {/*  En-tête                                                      */}
      {/* ------------------------------------------------------------ */}
      <header className="nid-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted">
            {detail.photo_url ? (
              <Image
                src={detail.photo_url}
                alt={`${asset.brand} ${asset.model}`}
                width={80}
                height={80}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <Smartphone className="size-8 text-muted-foreground" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                {asset.brand} {asset.model}
              </h1>
              {asset.status !== "active" ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {ASSET_STATUS_LABELS[asset.status]}
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-xs tracking-wider text-muted-foreground">
              {asset.public_id}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <HealthBadge state={healthState} />
              <span className="text-xs text-muted-foreground">
                Propriétaire : <span className="text-foreground">Vous</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {lastCheckup
                  ? `Dernier bilan : ${formatShortDate(lastCheckup.answered_at)} — ${CHECK_ANSWER_SHORT[lastCheckup.answer]}`
                  : "Aucun bilan enregistré"}
              </span>
              <span className="text-xs text-muted-foreground">
                {warrantyEnd
                  ? `Garantie jusqu’au ${formatEventDate(warrantyEnd)}`
                  : warrantyEvent
                    ? `Garantie : ${warrantyEvent.title}`
                    : "Garantie non renseignée"}
              </span>
            </div>
          </div>
        </div>

        {/* Ce qui manque — une liste claire, jamais un score. */}
        {completeness.rules.some((rule) => !rule.done) ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">Ce qui pourrait être complété</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {completeness.rules.map((rule) => (
                <li
                  key={rule.key}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    rule.done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {rule.done ? (
                    <Check className="size-3.5 shrink-0 text-[var(--nid-success)]" aria-hidden />
                  ) : (
                    <Minus className="size-3.5 shrink-0" aria-hidden />
                  )}
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button data-touch render={<Link href={`/id/app/objets/${asset.id}#bilan`} />}>
            <ClipboardCheck className="size-4" data-icon="inline-start" />
            Faire le bilan
          </Button>
          <Button
            variant="outline"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}#reparations`} />}
          >
            <Wrench className="size-4" data-icon="inline-start" />
            Ajouter une réparation
          </Button>
          <Button
            variant="outline"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}?onglet=documents`} />}
          >
            <FileText className="size-4" data-icon="inline-start" />
            Documents
          </Button>
          <Button
            variant="outline"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}/partager`} />}
          >
            <Share2 className="size-4" data-icon="inline-start" />
            Partager
          </Button>
          <Button
            variant="ghost"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}/evenement`} />}
          >
            <CalendarPlus className="size-4" data-icon="inline-start" />
            Ajouter un événement
          </Button>
          <Button
            variant="ghost"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}/transfert`} />}
          >
            <ArrowLeftRight className="size-4" data-icon="inline-start" />
            Transférer
          </Button>
          <Button
            variant="ghost"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}/qr`} />}
          >
            <QrCode className="size-4" data-icon="inline-start" />
            QR
          </Button>
          <Button
            variant="ghost"
            data-touch
            render={<Link href={`/id/app/objets/${asset.id}/modifier`} />}
          >
            <Pencil className="size-4" data-icon="inline-start" />
            Modifier
          </Button>
        </div>

        {detail.pending_transfer ? (
          <p className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--nid-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-info)_10%,transparent)] px-4 py-3 text-sm text-foreground">
            Un transfert est en cours vers{" "}
            <strong>{detail.pending_transfer.recipient_email}</strong>. Vous
            pouvez l’annuler depuis la page{" "}
            <Link href="/id/app/transferts" className="underline underline-offset-2">
              Transferts
            </Link>
            .
          </p>
        ) : null}
      </header>

      {/* ------------------------------------------------------------ */}
      {/*  Onglets                                                      */}
      {/* ------------------------------------------------------------ */}
      <nav aria-label="Sections du téléphone" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/id/app/objets/${asset.id}?onglet=${item.key}`}
            aria-current={tab === item.key ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors",
              tab === item.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {item.key === "historique" && events.length > 0 ? (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {events.length}
              </span>
            ) : null}
            {item.key === "documents" && documents.length > 0 ? (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {documents.length}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {/* ------------------------------------------------------------ */}
      {/*  Aperçu                                                       */}
      {/* ------------------------------------------------------------ */}
      {tab === "apercu" ? (
        <div className="space-y-6">
          <CheckupPanel
            assetId={asset.id}
            frequencyMonths={schedule?.frequency_months ?? 1}
            enabled={schedule?.enabled ?? true}
            nextCheckOn={schedule?.next_due_on ?? null}
            lastCheckAt={lastCheckup?.answered_at ?? null}
            canSendLink={canEdit}
          />

          <div id="reparations" className="scroll-mt-20">
            <RepairPanel assetId={asset.id} orders={repairs} canEdit={canEdit} />
          </div>

          <section>
            <h2 className="text-sm font-semibold text-foreground">Caractéristiques</h2>
            <dl className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
              {[
                { label: "Marque", value: asset.brand },
                { label: "Modèle", value: asset.model },
                { label: "Couleur", value: asset.color || "—" },
                { label: "Stockage", value: asset.storage_capacity || "—" },
                { label: "Date d’achat", value: formatEventDate(asset.purchase_date) },
                { label: "Vendeur", value: asset.purchase_source || "—" },
                {
                  label: "État à l’acquisition",
                  value: PURCHASE_CONDITION_LABELS[asset.purchase_condition],
                },
                { label: "Créé le", value: formatShortDate(asset.created_at) },
              ].map((item) => (
                <div key={item.label} className="bg-card px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">Identifiants privés</h2>
            <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Numéro de série</span>
                <span className="font-mono text-foreground">
                  {detail.serial_number || maskIdentifier(asset.serial_last4)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">IMEI</span>
                <span className="font-mono text-foreground">
                  {detail.imei || maskIdentifier(asset.imei_last4)}
                </span>
              </p>
              <p className="pt-1 text-xs text-muted-foreground">
                Visibles uniquement par vous. Sur une page publique ou un lien
                partagé, seuls les quatre derniers caractères peuvent
                apparaître, et seulement si vous l’autorisez.
              </p>
            </div>
          </section>

          {conditionEntries.length > 0 || condition.comment ? (
            <section>
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                État déclaré
                <SourceBadge source="declare_proprietaire" />
              </h2>
              <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {conditionEntries.map((entry) => (
                    <li key={entry.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{entry.label}</span>
                      <span className="font-medium text-foreground">
                        {CONDITION_GRADE_LABELS[entry.grade as ConditionGrade]}
                      </span>
                    </li>
                  ))}
                </ul>
                {typeof condition.battery_health === "number" ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Santé de la batterie :{" "}
                    <span className="font-medium text-foreground">
                      {condition.battery_health} %
                    </span>
                  </p>
                ) : null}
                {condition.comment ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {condition.comment}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Garantie</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {warrantyEvent ? warrantyEvent.title : "Aucune garantie enregistrée"}
              </p>
              {warrantyEvent ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ajoutée le {formatEventDate(warrantyEvent.effective_date)}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Dernier contrôle professionnel</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {lastProfessionalEvent
                  ? lastProfessionalEvent.title
                  : "Aucune intervention professionnelle"}
              </p>
              {lastProfessionalEvent ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {lastProfessionalEvent.author_label} ·{" "}
                  {formatEventDate(lastProfessionalEvent.effective_date)}
                </p>
              ) : null}
            </div>
          </section>

          {conditionPhotos.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {conditionPhotos.map((item) =>
                  item.url ? (
                    <li
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-border bg-muted"
                    >
                      <Image
                        src={item.url}
                        alt={item.caption || "Photo du téléphone"}
                        width={200}
                        height={200}
                        unoptimized
                        className="aspect-square w-full object-cover"
                      />
                    </li>
                  ) : null
                )}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/*  Historique                                                   */}
      {/* ------------------------------------------------------------ */}
      {tab === "historique" ? (
        <section>
          {events.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Aucun événement enregistré. Ajoutez une réparation, un contrôle
              d’état ou une garantie pour construire l’historique.
            </p>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => {
                const cost = formatMoneyFromCents(event.cost_cents);
                const parts = (event.metadata?.parts as string | undefined) ?? "";
                const partsOrigin = (event.metadata?.parts_origin as string | undefined) ?? "";
                const warranty = event.metadata?.warranty_months as number | null | undefined;
                return (
                  <li key={event.id} className="nid-panel rounded-2xl p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-foreground">{event.title}</h3>
                      {event.revoked_at ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          Corrigé
                        </span>
                      ) : (
                        <SourceBadge
                          source={
                            (event as { source_type?: string }).source_type ??
                            (event.trust_level === 2 ? "atteste_reparateur" : "declare_proprietaire")
                          }
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {EVENT_TYPE_LABELS[event.type]} ·{" "}
                      {formatEventDate(event.effective_date)}
                      {event.author_label ? ` · ${event.author_label}` : ""}
                      {cost ? ` · ${cost}` : ""}
                    </p>

                    {event.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}

                    {parts || partsOrigin || warranty ? (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {parts ? <li>Pièces remplacées : {parts}</li> : null}
                        {partsOrigin ? <li>Origine des pièces : {partsOrigin}</li> : null}
                        {warranty ? <li>Garantie d’intervention : {warranty} mois</li> : null}
                      </ul>
                    ) : null}

                    {event.media.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {event.media.map((item) =>
                          item.url ? (
                            <li key={item.id}>
                              <Image
                                src={item.url}
                                alt={item.caption || "Photo de l’intervention"}
                                width={72}
                                height={72}
                                unoptimized
                                className="size-18 rounded-lg border border-border object-cover"
                              />
                            </li>
                          ) : null
                        )}
                      </ul>
                    ) : null}

                    {event.documents_count > 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {event.documents_count} document
                        {event.documents_count > 1 ? "s" : ""} joint
                        {event.documents_count > 1 ? "s" : ""} — onglet Documents.
                      </p>
                    ) : null}

                    {event.revoked_at ? (
                      <p className="mt-3 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                        Révoqué le {formatShortDate(event.revoked_at)}
                        {event.revocation_reason ? ` — ${event.revocation_reason}` : ""}
                      </p>
                    ) : canEdit ? (
                      <EventActions
                        assetId={asset.id}
                        eventId={event.id}
                        canRevoke={event.author_role === "proprietaire"}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/*  Documents                                                    */}
      {/* ------------------------------------------------------------ */}
      {tab === "documents" ? (
        <DocumentManager assetId={asset.id} documents={documents} canEdit={canEdit} />
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/*  Accès                                                        */}
      {/* ------------------------------------------------------------ */}
      {tab === "acces" ? (
        <AccessManager
          assetId={asset.id}
          activeShares={detail.shares_active}
          inactiveShares={detail.shares_closed}
          access={pro_access}
          canEdit={canEdit}
        />
      ) : null}
    </div>
  );
}
