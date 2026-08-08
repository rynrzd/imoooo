import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InterventionForm } from "@/components/nireo-id/intervention-form";
import { ProEventActions } from "@/components/nireo-id/pro-event-actions";
import { TrustBadge } from "@/components/nireo-id/trust-badge";
import {
  CONDITION_GRADE_LABELS,
  CONDITION_POINTS,
  EVENT_TYPE_LABELS,
  type ConditionGrade,
} from "@/features/nireo-id/constants";
import { formatEventDate, formatRemaining, maskIdentifier } from "@/features/nireo-id/format";
import { getProfessionalProfile, requireNidSession } from "@/features/nireo-id/server/guards";
import { getProAssetView } from "@/features/nireo-id/server/professionals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passeport client",
  robots: { index: false, follow: false },
};

export default async function ProAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireNidSession(`/id/pro/objets/${id}`);
  const profile = await getProfessionalProfile(session.user.id);

  const view =
    profile?.status === "approuve" ? await getProAssetView(session.user.id, id) : null;

  if (!view) {
    return (
      <div className="space-y-5">
        <p className="text-sm">
          <Link href="/id/pro" className="text-muted-foreground underline-offset-2 hover:underline">
            ← Espace professionnel
          </Link>
        </p>
        <div className="nid-panel rounded-2xl p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-foreground">Accès non autorisé</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {profile?.status === "approuve"
              ? "Le propriétaire ne vous a pas (ou plus) donné accès à ce passeport. Demandez-lui une nouvelle autorisation."
              : "Votre compte professionnel doit être approuvé par Nireo pour consulter un passeport client."}
          </p>
          <div className="mt-6">
            <Button render={<Link href="/id/pro" />}>Retour à l’espace professionnel</Button>
          </div>
        </div>
      </div>
    );
  }

  const condition = view.asset.declared_condition ?? {};
  const conditionEntries = CONDITION_POINTS.map((point) => ({
    label: point.label,
    grade: condition[point.key] as ConditionGrade | undefined,
  })).filter((entry) => entry.grade);

  const myEvents = view.events.filter((event) => event.professional_id === profile?.id);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/id/pro" className="text-muted-foreground underline-offset-2 hover:underline">
          ← Espace professionnel
        </Link>
      </p>

      <header className="nid-panel nid-topline rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted">
            {view.photo_url ? (
              <Image
                src={view.photo_url}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <Smartphone className="size-7 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">
              {view.asset.brand} {view.asset.model}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {view.asset.public_id}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Accès accordé — expire dans {formatRemaining(view.access.expires_at)}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {[
            { label: "Couleur", value: view.asset.color || "—" },
            { label: "Stockage", value: view.asset.storage_capacity || "—" },
            { label: "N° de série", value: maskIdentifier(view.asset.serial_last4) },
            { label: "IMEI", value: maskIdentifier(view.asset.imei_last4) },
          ].map((item) => (
            <div key={item.label} className="bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">
          Les identifiants complets et les documents privés du propriétaire ne
          sont jamais accessibles depuis l’espace professionnel.
        </p>
      </header>

      {conditionEntries.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            État déclaré par le propriétaire
            <TrustBadge level={0} />
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {conditionEntries.map((entry) => (
              <li key={entry.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="font-medium text-foreground">
                  {CONDITION_GRADE_LABELS[entry.grade as ConditionGrade]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-foreground">Historique de l’appareil</h2>
        {view.events.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Aucun événement enregistré.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {view.events.map((event) => (
              <li key={event.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">{event.title}</h3>
                  <TrustBadge level={event.revoked_at ? 4 : event.trust_level} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.type]} · {formatEventDate(event.effective_date)}
                  {event.author_label ? ` · ${event.author_label}` : ""}
                </p>
                {event.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
                ) : null}
                {event.revoked_at ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Révoqué — {event.revocation_reason || "sans motif renseigné"}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {myEvents.some((event) => !event.revoked_at) ? (
        <section>
          <h2 className="text-sm font-semibold text-foreground">Corriger une de mes interventions</h2>
          <ul className="mt-3 space-y-2">
            {myEvents
              .filter((event) => !event.revoked_at)
              .map((event) => (
                <li key={event.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventDate(event.effective_date)}
                  </p>
                  <ProEventActions assetId={id} eventId={event.id} />
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <InterventionForm assetId={id} />
    </div>
  );
}
