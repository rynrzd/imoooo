"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  Hammer,
  Receipt,
  ScrollText,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PropertyThumb } from "@/components/properties/property-thumb";
import { CollectRentSheet } from "@/components/rents/collect-rent-sheet";
import { currentMonthKey } from "@/lib/dates";
import { getOccupancyRate } from "@/lib/finance";
import {
  formatCurrency,
  formatDate,
  formatDateLong,
  formatPercent,
} from "@/lib/format";
import { getActionItems, type ActionItem } from "@/lib/insights";
import { useAppStore } from "@/lib/store";
import type { ActivityItem, AppData, Property } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * TABLEAU DE BORD — TÉLÉPHONE.
 *
 * L'ordre est celui de la maquette validée, et il répond à une seule question :
 * « qu'est-ce que je dois savoir maintenant ? »
 *
 *   1. la date              5. une action principale
 *   2. la salutation        6. les logements
 *   3. l'état réel du jour  7. l'activité récente
 *   4. le résumé du mois
 *
 * Aucune grande carte : des chiffres posés sur le fond, séparés par des filets.
 * Le vert ne sert qu'aux loyers encaissés, le rouge qu'aux retards.
 */

/* ------------------------------------------------------------------ */
/*  Salutation                                                         */
/* ------------------------------------------------------------------ */

/** Salutation réellement dépendante de l'heure locale. */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 6) return "Bonne nuit";
  if (hour < 18) return "Bonjour";
  return "Bonsoir";
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

export function MobileDashboard() {
  const { data, profile } = useAppStore();
  const [collectOpen, setCollectOpen] = React.useState(false);

  // L'heure n'est connue qu'après hydratation : la calculer au rendu serveur
  // produirait « Bonjour » côté serveur et « Bonsoir » côté client.
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
    const id = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const month = currentMonthKey();
  const monthPayments = data.rentPayments.filter((p) => p.month === month);
  const received = monthPayments.reduce((acc, p) => acc + p.received, 0);
  const late = data.rentPayments
    .filter((p) => p.status === "retard")
    .reduce((acc, p) => acc + (p.expected - p.received), 0);
  const occupancy = getOccupancyRate(data);

  const actions = getActionItems(data);
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="space-y-8 lg:hidden">
      {/* ---------- 1 et 2 : la date, puis la salutation ---------- */}
      <header className="space-y-2">
        <p className="text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
          {formatDateLong(now ?? new Date()).replace(/\s\d{4}$/, "")}
        </p>
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-foreground">
          {now ? greetingFor(now) : "Bonjour"}
          {firstName ? ` ${firstName}` : ""}.
        </h1>

        {/* ---------- 3 : l'état RÉEL du jour ---------- */}
        <TodayState actions={actions} />
      </header>

      {/* ---------- 4 : le résumé du mois ---------- */}
      <section aria-labelledby="ce-mois-ci" className="space-y-3">
        <h2 id="ce-mois-ci" className="text-lg font-semibold text-foreground">
          Ce mois-ci
        </h2>
        <div className="flex items-stretch gap-4">
          <div className="min-w-0">
            <p className="text-[2rem] leading-none font-semibold tracking-[-0.03em] tabular-nums text-foreground">
              {formatCurrency(received)}
            </p>
            <p className="pt-1 text-sm text-muted-foreground">Encaissé</p>
          </div>
          <span aria-hidden className="w-px shrink-0 bg-border" />
          <div className="min-w-0">
            <p
              className={cn(
                "text-lg leading-none font-semibold tabular-nums",
                late > 0 ? "text-danger" : "text-foreground"
              )}
            >
              {formatCurrency(late)}
            </p>
            <p className="pt-1.5 text-sm text-muted-foreground">en retard</p>
          </div>
          <span aria-hidden className="w-px shrink-0 bg-border" />
          <div className="min-w-0">
            <p className="text-lg leading-none font-semibold tabular-nums text-foreground">
              {formatPercent(occupancy, 0)}
            </p>
            <p className="pt-1.5 text-sm text-muted-foreground">occupé</p>
          </div>
        </div>

        {/* ---------- 5 : une seule action principale ---------- */}
        <button
          type="button"
          onClick={() => setCollectOpen(true)}
          className="flex min-h-12 items-center justify-center rounded-[0.625rem] bg-primary px-5 text-[0.95rem] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-95"
        >
          Ajouter un encaissement
        </button>
      </section>

      {/* ---------- 6 : les logements ---------- */}
      <PropertyThreads data={data} />

      {/* ---------- 7 : l'activité récente ---------- */}
      <RecentActivityThread items={data.activity} />

      {collectOpen ? (
        <CollectRentSheet open onOpenChange={setCollectOpen} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  État du jour                                                       */
/* ------------------------------------------------------------------ */

/** Priorité d'affichage : on ne montre QUE la chose la plus urgente. */
function TodayState({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[0.95rem] text-muted-foreground">
        Tout est à jour aujourd&apos;hui.
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
      </p>
    );
  }

  // La consigne est stricte : « Tout est à jour » ne doit JAMAIS s'afficher
  // quand quelque chose attend. On nomme alors l'action réelle.
  const first = actions[0];
  const others = actions.length - 1;
  return (
    <div className="space-y-2 pt-1">
      <p className="flex items-center gap-2 text-[0.95rem] font-medium text-foreground">
        <AlertTriangle
          className={cn(
            "size-4 shrink-0",
            first.severity === "critique" ? "text-danger" : "text-warning"
          )}
          aria-hidden
        />
        {actions.length === 1
          ? "Une chose demande votre attention."
          : `${actions.length} choses demandent votre attention.`}
      </p>
      <Link
        href={hrefForAction(first)}
        className="flex min-h-12 items-center gap-3 rounded-[0.625rem] border border-border bg-card px-3.5 transition-colors duration-200 hover:bg-accent/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {first.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {first.description}
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
      </Link>
      {others > 0 ? (
        <Link
          href="/loyers"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Voir les {others} autre{others > 1 ? "s" : ""}
        </Link>
      ) : null}
    </div>
  );
}

/** Destination réelle d'une action — jamais un lien mort. */
function hrefForAction(item: ActionItem): string {
  switch (item.kind) {
    case "loyer_retard":
    case "loyer_partiel":
      return "/loyers";
    case "document_manquant":
    case "document_expire":
      return item.propertyId ? `/logements/${item.propertyId}` : "/documents";
    case "chantier_en_cours":
      return "/travaux";
    default:
      return item.propertyId ? `/logements/${item.propertyId}` : "/logements";
  }
}

/* ------------------------------------------------------------------ */
/*  Logements — la signature Nireo                                     */
/* ------------------------------------------------------------------ */

/**
 * Chaque logement, puis un FIN TRAIT BLEU qui le relie à ce qui lui appartient :
 * son bail, ses documents, son locataire, ses travaux. C'est la signature
 * visuelle de Nireo — l'idée que rien n'est isolé, tout est rattaché.
 */
function PropertyThreads({ data }: { data: AppData }) {
  if (data.properties.length === 0) return null;

  return (
    <section aria-labelledby="vos-logements" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="vos-logements" className="text-lg font-semibold text-foreground">
          Vos logements
        </h2>
        {data.properties.length > 3 ? (
          <Link
            href="/logements"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Tous
          </Link>
        ) : null}
      </div>

      <ul className="space-y-6">
        {data.properties.slice(0, 3).map((property) => (
          <li key={property.id}>
            <PropertyThread data={data} property={property} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PropertyThread({
  data,
  property,
}: {
  data: AppData;
  property: Property;
}) {
  const month = currentMonthKey();
  const payment =
    data.rentPayments.find(
      (p) => p.propertyId === property.id && p.month === month
    ) ?? null;
  const tenant =
    data.tenants.find((t) => t.propertyId === property.id && !t.exitDate) ?? null;
  const documents = data.documents.filter((d) => d.propertyId === property.id);
  const hasLease = documents.some((d) => d.category === "bail");
  const works = data.works.filter(
    (w) => w.propertyId === property.id && w.status !== "termine"
  );

  const paymentTone =
    payment === null
      ? null
      : payment.status === "paye"
        ? { label: "Payé", className: "bg-success-soft text-success" }
        : payment.status === "retard"
          ? { label: "En retard", className: "bg-danger-soft text-danger" }
          : payment.status === "partiel"
            ? { label: "Partiel", className: "bg-warning-soft text-warning" }
            : { label: "En attente", className: "bg-secondary text-muted-foreground" };

  // Les liens du fil : uniquement ce qui EXISTE réellement pour ce logement.
  const threads: { icon: LucideIcon; label: string; href: string; tone?: string }[] =
    [];
  if (tenant) {
    threads.push({
      icon: UserRound,
      label: `${tenant.firstName} ${tenant.lastName}`.trim() || "Locataire",
      href: `/locataires/${tenant.id}`,
    });
  }
  if (tenant) {
    threads.push({
      icon: ScrollText,
      label: hasLease ? "Bail · À jour" : "Bail · à ajouter",
      href: `/logements/${property.id}`,
      tone: hasLease ? undefined : "warning",
    });
  }
  if (documents.length > 0) {
    threads.push({
      icon: Folder,
      label: `${documents.length} document${documents.length > 1 ? "s" : ""}`,
      href: "/documents",
    });
  }
  if (works.length > 0) {
    threads.push({
      icon: Hammer,
      label: `${works.length} chantier${works.length > 1 ? "s" : ""} en cours`,
      href: "/travaux",
    });
  }

  return (
    <div>
      <Link
        href={`/logements/${property.id}`}
        className="flex min-h-14 items-center gap-3 rounded-xl py-1 transition-colors duration-200 hover:bg-accent/40"
      >
        <PropertyThumb
          src={property.photo}
          alt=""
          className="size-16 rounded-xl"
          sizes="64px"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.95rem] font-semibold text-foreground">
            {property.name}
          </span>
          <span className="flex items-center gap-1.5 pt-0.5">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                property.status === "loue" ? "bg-success" : "bg-muted-foreground/50"
              )}
            />
            <span
              className={cn(
                "text-sm",
                property.status === "loue" ? "text-success" : "text-muted-foreground"
              )}
            >
              {property.status === "loue" ? "Loué" : "Vacant"}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          {property.rent > 0 ? (
            <span className="block text-[0.95rem] font-semibold tabular-nums text-foreground">
              {formatCurrency(property.rent + property.charges)}
            </span>
          ) : null}
          {paymentTone ? (
            <span
              className={cn(
                "mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                paymentTone.className
              )}
            >
              {paymentTone.label}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
      </Link>

      {/* Le fil bleu : il PART du logement et rejoint chacun de ses éléments. */}
      {threads.length > 0 ? (
        <div className="relative pl-8">
          <span
            aria-hidden
            className="absolute top-0 bottom-6 left-[1.4375rem] w-px bg-primary/35"
          />
          <span
            aria-hidden
            className="absolute top-0 left-5 size-2 rounded-full bg-primary"
          />
          <ul>
            {threads.map((thread) => (
              <li key={thread.label} className="relative">
                <span
                  aria-hidden
                  className="absolute top-1/2 -left-[0.5625rem] h-px w-3 bg-primary/35"
                />
                <Link
                  href={thread.href}
                  className="flex min-h-12 items-center gap-3 border-b border-border pl-2 transition-colors duration-200 last:border-b-0 hover:bg-accent/40"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card">
                    <thread.icon
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      thread.tone === "warning" ? "text-warning" : "text-foreground"
                    )}
                  >
                    {thread.label}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activité récente                                                   */
/* ------------------------------------------------------------------ */

const ACTIVITY_STYLE: Record<
  ActivityItem["type"],
  { icon: LucideIcon; className: string }
> = {
  paiement: { icon: ArrowDownLeft, className: "bg-success-soft text-success" },
  retard: { icon: AlertTriangle, className: "bg-danger-soft text-danger" },
  travaux: { icon: Hammer, className: "bg-expense-soft text-expense" },
  depense: { icon: Receipt, className: "bg-expense-soft text-expense" },
  document: { icon: FileText, className: "bg-primary-soft text-primary" },
  locataire: { icon: UserRound, className: "bg-primary-soft text-primary" },
  logement: { icon: Folder, className: "bg-primary-soft text-primary" },
  photo: { icon: FileText, className: "bg-primary-soft text-primary" },
};

/** « Aujourd'hui », « Hier », puis la date — comme sur la maquette. */
function relativeDay(iso: string): string {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  if (iso === todayIso) return "Aujourd'hui";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return "Hier";
  return formatDate(iso);
}

function RecentActivityThread({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;
  const visible = items.slice(0, 5);

  return (
    <section aria-labelledby="activite" className="space-y-3">
      <h2 id="activite" className="text-lg font-semibold text-foreground">
        Activité récente
      </h2>
      <ul className="relative">
        {visible.map((item, index) => {
          const style = ACTIVITY_STYLE[item.type];
          const last = index === visible.length - 1;
          return (
            <li key={item.id} className="relative flex gap-3 pb-1">
              {/* Le fil vertical relie les événements entre eux. */}
              {!last ? (
                <span
                  aria-hidden
                  className="absolute top-9 bottom-0 left-[0.9375rem] w-px bg-border"
                />
              ) : null}
              <span
                className={cn(
                  "z-10 grid size-8 shrink-0 place-items-center rounded-full",
                  style.className
                )}
              >
                <style.icon className="size-4" aria-hidden />
              </span>
              <span
                className={cn(
                  "flex min-w-0 flex-1 items-start justify-between gap-3 pb-3",
                  !last && "border-b border-border"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.message}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDay(item.date)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/statistiques"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voir les statistiques
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
