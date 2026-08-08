import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarClock,
  Clock,
  Download,
  FileText,
  Link2Off,
  Lock,
  SearchX,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NidPublicFooter } from "@/components/nireo-id/public-footer";
import { NidPublicHeader } from "@/components/nireo-id/public-header";
import { TrustBadge } from "@/components/nireo-id/trust-badge";
import {
  CONDITION_GRADE_LABELS,
  CONDITION_POINTS,
  EVENT_TYPE_LABELS,
  PURCHASE_CONDITION_LABELS,
  type ConditionGrade,
} from "@/features/nireo-id/constants";
import {
  formatDateTime,
  formatEventDate,
  formatFileSize,
  formatMoneyFromCents,
  formatRemaining,
} from "@/features/nireo-id/format";
import { resolveShare } from "@/features/nireo-id/server/sharing";
import { nidSignedUrlMap } from "@/features/nireo-id/server/storage";

/**
 * DOSSIER PARTAGÉ par lien.
 *
 * Le jeton n'ouvre que les sections choisies par le propriétaire, pour la
 * durée choisie. Les états « expiré », « révoqué » et « introuvable » sont
 * traités explicitement : aucune donnée n'apparaît dans ces cas.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dossier partagé",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <NidPublicHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-14">{children}</div>
      </main>
      <NidPublicFooter />
    </div>
  );
}

function StateCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Clock;
  title: string;
  text: string;
}) {
  return (
    <Shell>
      <div className="nid-panel rounded-2xl p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
        <div className="mt-6">
          <Button data-touch render={<Link href="/id" />}>
            Découvrir Nireo ID
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export default async function SharedPassportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await resolveShare(decodeURIComponent(token));

  if (resolution.state === "expire") {
    return (
      <StateCard
        icon={Clock}
        title="Ce lien a expiré"
        text="Le propriétaire avait fixé une durée de validité, désormais dépassée. Demandez-lui un nouveau lien."
      />
    );
  }
  if (resolution.state === "revoque") {
    return (
      <StateCard
        icon={Link2Off}
        title="Ce lien a été révoqué"
        text="Le propriétaire a coupé l’accès à ce dossier. Aucune information n’est consultable."
      />
    );
  }
  if (resolution.state !== "valide") {
    return (
      <StateCard
        icon={SearchX}
        title="Lien introuvable"
        text="Ce lien de partage n’existe pas. Vérifiez que l’adresse a été copiée en entier."
      />
    );
  }

  const { share, asset, events, media, documents } = resolution;
  const showCharacteristics = share.sections.includes("caracteristiques");
  const showHistory = share.sections.includes("historique");
  const showPhotos = share.sections.includes("photos");
  const showDocuments = share.sections.includes("documents");

  const paths = [
    ...(showPhotos ? media.map((item) => item.storage_path) : []),
    ...(showDocuments && share.allow_download ? documents.map((item) => item.storage_path) : []),
    ...(asset.primary_image_path ? [asset.primary_image_path] : []),
  ];
  const urls = await nidSignedUrlMap(paths);
  const coverUrl = asset.primary_image_path ? (urls.get(asset.primary_image_path) ?? null) : null;

  const condition = asset.declared_condition ?? {};
  const conditionEntries = CONDITION_POINTS.map((point) => ({
    label: point.label,
    grade: condition[point.key] as ConditionGrade | undefined,
  })).filter((entry) => entry.grade);

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 text-primary" aria-hidden />
          Dossier partagé par le propriétaire
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          Expire dans {formatRemaining(share.expires_at)} ({formatDateTime(share.expires_at)})
        </p>
      </div>

      <header className="nid-panel nid-topline mt-4 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`${asset.brand} ${asset.model}`}
              width={96}
              height={96}
              unoptimized
              className="size-full object-cover"
            />
          ) : (
            <Smartphone className="size-8 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wider text-muted-foreground">{asset.public_id}</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {asset.brand} {asset.model}
          </h1>
          {share.label ? (
            <p className="mt-1 text-sm text-muted-foreground">{share.label}</p>
          ) : null}
        </div>
      </header>

      {showCharacteristics ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Caractéristiques</h2>
          <dl className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {[
              { label: "Couleur", value: asset.color || "—" },
              { label: "Stockage", value: asset.storage_capacity || "—" },
              {
                label: "État à l’acquisition",
                value: PURCHASE_CONDITION_LABELS[asset.purchase_condition],
              },
              { label: "Date d’achat", value: formatEventDate(asset.purchase_date) },
              ...(asset.serial_last4
                ? [{ label: "N° de série", value: `•••• ${asset.serial_last4}` }]
                : []),
            ].map((item) => (
              <div key={item.label} className="bg-card px-4 py-3">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>

          {conditionEntries.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">
                État déclaré par le propriétaire
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
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
                  Santé de la batterie déclarée :{" "}
                  <span className="font-medium text-foreground">{condition.battery_health} %</span>
                </p>
              ) : null}
              {condition.comment ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {condition.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {showHistory ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Historique</h2>
          {events.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Aucun événement n’a encore été enregistré sur ce passeport.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {events.map((event) => {
                const cost = formatMoneyFromCents(event.cost_cents);
                return (
                  <li key={event.id} className="nid-panel rounded-2xl p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-foreground">{event.title}</h3>
                      <TrustBadge level={event.revoked_at ? 4 : event.trust_level} variant="full" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {EVENT_TYPE_LABELS[event.type]} · {formatEventDate(event.effective_date)}
                      {event.author_label ? ` · ${event.author_label}` : ""}
                      {cost ? ` · ${cost}` : ""}
                    </p>
                    {event.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      {showPhotos ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Photos</h2>
          {media.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Aucune photo n’a été ajoutée à ce passeport.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((item) => {
                const url = urls.get(item.storage_path);
                if (!url) return null;
                return (
                  <li
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-border bg-muted"
                  >
                    <Image
                      src={url}
                      alt={item.caption || "Photo du smartphone"}
                      width={320}
                      height={320}
                      unoptimized
                      className="aspect-square w-full object-cover"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {showDocuments ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Documents</h2>
          {documents.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Le propriétaire n’a partagé aucun document.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {documents.map((document) => {
                const url = share.allow_download ? urls.get(document.storage_path) : null;
                return (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {document.original_name || "Document"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatFileSize(document.size_bytes)}
                        </span>
                      </span>
                    </span>
                    {url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        render={<a href={url} target="_blank" rel="noreferrer" />}
                      >
                        <Download className="size-3.5" data-icon="inline-start" />
                        Ouvrir
                      </Button>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Téléchargement désactivé
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <p className="mt-8 rounded-2xl border border-border bg-card p-5 text-xs leading-relaxed text-muted-foreground">
        Ce dossier est partagé par le propriétaire actuel du passeport. Nireo ne
        certifie pas l’authenticité des documents fournis et ne réalise aucun
        contrôle d’appareil déclaré volé. Le lien peut être révoqué à tout
        moment ; l’IMEI et le numéro de série complets ne sont jamais partagés.
      </p>
    </Shell>
  );
}
