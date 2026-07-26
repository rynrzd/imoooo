"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Euro,
  Eye,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
  Smartphone,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsSnapshot,
  type LiveEvent,
  type SeriesPoint,
  type Slice,
} from "@/lib/analytics/queries";

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "24h": "24 h",
  "7d": "7 jours",
  "30d": "30 jours",
  "12m": "12 mois",
};

const SOURCE_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  google: "Google",
  direct: "Accès direct",
  other: "Autres",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Ordinateur",
  tablet: "Tablette",
};

const EVENT_META: Record<LiveEvent["type"], { label: string; className: string }> = {
  page_view: { label: "Page vue", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  signup: { label: "Compte créé", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  property_added: { label: "Logement ajouté", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  payment_started: { label: "Paiement démarré", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  subscription_success: { label: "Abonnement réussi", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  payment_failed: { label: "Paiement échoué", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const REFRESH_MS = 20_000;
const nf = new Intl.NumberFormat("fr-FR");

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1).replace(".", ",")} %`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

function bucketLabel(iso: string, range: AnalyticsRange): string {
  const d = new Date(iso);
  const tz = "Europe/Paris";
  if (range === "24h") return d.toLocaleTimeString("fr-FR", { hour: "2-digit", timeZone: tz });
  if (range === "12m") return d.toLocaleDateString("fr-FR", { month: "short", timeZone: tz });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: tz });
}

/** Graphique de fréquentation — barres (pages vues) + ligne (visiteurs). */
function VisitsChart({ series, range }: { series: SeriesPoint[]; range: AnalyticsRange }) {
  const max = Math.max(1, ...series.map((p) => p.views));
  const hasData = series.some((p) => p.views > 0 || p.visitors > 0);
  const n = series.length;
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  if (!hasData) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
        Aucune visite enregistrée sur cette période.
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-44">
        <div className="flex h-full items-end gap-px">
          {series.map((p) => (
            <div
              key={p.bucket}
              className="flex-1 rounded-t-sm bg-primary/70 transition-all hover:bg-primary"
              style={{ height: `${Math.max(p.views > 0 ? 2 : 0, (p.views / max) * 100)}%` }}
              title={`${bucketLabel(p.bucket, range)} · ${nf.format(p.views)} vues · ${nf.format(p.visitors)} visiteurs`}
            />
          ))}
        </div>
        {n >= 2 ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full text-foreground/70"
            viewBox={`0 0 ${n} 100`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              points={series.map((p, i) => `${i + 0.5},${100 - (p.visitors / max) * 100}`).join(" ")}
            />
          </svg>
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        {series.map((p, i) =>
          i % labelEvery === 0 ? <span key={p.bucket}>{bucketLabel(p.bucket, range)}</span> : null
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/70" /> Pages vues
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-foreground/70" /> Visiteurs uniques
        </span>
      </div>
    </div>
  );
}

/** Liste « barre » pour une répartition (sources, appareils, pages, pays…). */
function BarList({
  title,
  icon: Icon,
  data,
  labels,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: Slice[];
  labels?: Record<string, string>;
  empty: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground/70" />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {data.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((d) => (
            <li key={d.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{labels?.[d.key] ?? d.key}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{nf.format(d.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${total > 0 ? Math.max(3, (d.count / total) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalyticsDashboard({ initial }: { initial: AnalyticsSnapshot }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(initial);
  const [range, setRange] = useState<AnalyticsRange>(initial.range);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (nextRange: AnalyticsRange, silent: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${nextRange}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AnalyticsSnapshot;
      setSnapshot(data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Impossible d'actualiser les statistiques. Nouvelle tentative automatique.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Changement de plage : rechargement immédiat.
  const onRangeChange = (next: AnalyticsRange) => {
    setRange(next);
    void load(next, false);
  };

  // Rafraîchissement automatique (uniquement quand l'onglet est visible).
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load(range, true);
    };
    const id = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [range, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const k = snapshot.kpis;
  const b = snapshot.breakdowns;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-foreground">{nf.format(k.onlineNow)}</span> en ligne
            </span>
            <span aria-hidden>·</span>
            <span>Actualisé {relativeTime(updatedAt.toISOString())}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            {ANALYTICS_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(range, false)}
            disabled={loading}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground disabled:opacity-50"
            aria-label="Actualiser"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Audience */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="En ligne maintenant" value={nf.format(k.onlineNow)} icon={Users} hint="5 dernières minutes" />
        <StatCard label="Visiteurs — aujourd'hui" value={nf.format(k.uniqueToday)} icon={Users} />
        <StatCard label="Visiteurs — cette semaine" value={nf.format(k.uniqueWeek)} icon={Users} />
        <StatCard label="Visiteurs — ce mois" value={nf.format(k.uniqueMonth)} icon={Users} />
      </section>

      {/* Graphique + pages actives */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Fréquentation — {RANGE_LABELS[range]}</h2>
            <span className="text-xs text-muted-foreground">
              {nf.format(k.totalViews)} pages vues au total
            </span>
          </div>
          <VisitsChart series={snapshot.series} range={range} />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground/70" />
            <h2 className="text-sm font-medium">Pages consultées maintenant</h2>
          </div>
          {snapshot.activePages.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Aucun visiteur actif en ce moment.</p>
          ) : (
            <ul className="space-y-2">
              {snapshot.activePages.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-mono text-xs">{p.key}</span>
                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    <Users className="size-3" /> {nf.format(p.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Acquisition & conversion */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Inscriptions — aujourd'hui" value={nf.format(k.signupsToday)} icon={UserPlus} />
        <StatCard label="Inscriptions — semaine" value={nf.format(k.signupsWeek)} icon={UserPlus} />
        <StatCard label="Nouveaux abonnements — mois" value={nf.format(k.subsMonth)} icon={CreditCard} />
        <StatCard label="Revenu nouveaux abonnements — mois" value={euros(k.revenueMonthCents)} icon={Euro} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Conversion visiteurs → inscriptions"
          value={pct(k.signupsMonth, k.uniqueMonth)}
          hint="30 jours glissants"
          icon={TrendingUp}
        />
        <StatCard
          label="Conversion inscriptions → abonnements"
          value={pct(k.subsMonth, k.signupsMonth)}
          hint="Ce mois-ci"
          icon={TrendingUp}
        />
        <StatCard
          label="Conversion visiteurs → abonnements"
          value={pct(k.subsMonth, k.uniqueMonth)}
          hint="Ce mois-ci"
          icon={TrendingUp}
        />
      </section>

      {/* Répartitions */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BarList title="Sources de trafic" icon={Globe} data={b.sources} labels={SOURCE_LABELS} empty="Aucune source sur cette période." />
        <BarList title="Appareils" icon={Smartphone} data={b.devices} labels={DEVICE_LABELS} empty="Aucun appareil enregistré." />
        <BarList title="Pages les plus visitées" icon={Eye} data={b.topPages} empty="Aucune page vue sur cette période." />
        <BarList title="Pays" icon={Globe} data={b.countries} empty="Données de localisation indisponibles." />
        <BarList title="Villes" icon={MapPin} data={b.cities} empty="Données de localisation indisponibles." />

        {/* Activité en direct */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:col-span-2 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-sm font-medium">Activité en direct</h2>
          </div>
          {snapshot.live.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Aucun événement récent.</p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {snapshot.live.map((ev, i) => {
                const meta = EVENT_META[ev.type];
                return (
                  <li key={`${ev.at}-${i}`} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", meta.className)}>
                        {meta.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {ev.type === "page_view"
                          ? ev.path
                          : ev.amountCents != null
                            ? euros(ev.amountCents)
                            : ev.plan ?? ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(ev.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {loading ? <Loader2 className="size-3 animate-spin" /> : null}
        Données réelles, first-party (RGPD, sans cookie de suivi) · actualisation automatique toutes les 20 s.
      </p>
    </div>
  );
}
