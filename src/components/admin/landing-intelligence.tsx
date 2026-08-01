"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Activity,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/admin/stat-card";
import {
  LandingBehaviourPanel,
  LandingContentPanel,
  LandingHistoryPanel,
  LandingPersonalizationPanel,
  LandingVariantsPanel,
} from "@/components/admin/landing-panels";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  applyLandingRecommendation,
  dismissLandingRecommendation,
  composeBestLanding,
  rebalanceLandingWeights,
  runLandingAnalysis,
  updateLandingSettings,
} from "@/lib/landing/actions";
import { OBJECTIVE_LABELS } from "@/lib/landing/scoring";
import { LANDING_RANGES, type LandingRange } from "@/lib/landing/ranges";
import type {
  FunnelStep,
  LandingRecommendation,
  LandingSeriesPoint,
  LandingSnapshot,
} from "@/lib/landing/queries";
import { SEGMENT_LABELS } from "@/lib/landing/types";
import { cn } from "@/lib/utils";

/**
 * Landing Intelligence — tableau de bord.
 *
 * Chaque chiffre affiché ici provient d'une mesure réelle. Quand une donnée
 * n'existe pas encore, l'interface l'annonce (« pas encore assez de données »)
 * plutôt que d'afficher un score inventé.
 */

const RANGE_LABELS: Record<LandingRange, string> = {
  "24h": "24 h",
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
};

const nf = new Intl.NumberFormat("fr-FR");

export function ratio(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1).replace(".", ",")} %`;
}

function duration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  return `${m} min ${Math.round(seconds - m * 60)} s`;
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

/* ------------------------------------------------------------------ */
/*  Tunnel de conversion                                              */
/* ------------------------------------------------------------------ */

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = steps[0]?.count ?? 0;
  if (top === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune session mesurée sur cette période.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1]!.count : step.count;
        const width = Math.max(2, (step.count / top) * 100);
        const drop = previous > 0 ? 1 - step.count / previous : 0;
        return (
          <li key={step.key} className="group">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{step.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {nf.format(step.count)}
                <span className="ml-2 text-xs">{ratio(step.count, top)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-700 ease-out"
                style={{ width: `${width}%` }}
              />
            </div>
            {index > 0 && drop > 0.001 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                −{(drop * 100).toFixed(1).replace(".", ",")} % par rapport à l&apos;étape précédente
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Évolution                                                          */
/* ------------------------------------------------------------------ */

function EvolutionChart({ series, range }: { series: LandingSeriesPoint[]; range: LandingRange }) {
  const max = Math.max(1, ...series.map((p) => p.sessions));
  const hasData = series.some((p) => p.sessions > 0);
  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Aucune visite enregistrée sur cette période.
      </div>
    );
  }
  const label = (iso: string) => {
    const d = new Date(iso);
    return range === "24h"
      ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", timeZone: "Europe/Paris" })
      : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" });
  };
  return (
    <div>
      <div className="flex h-40 items-end gap-px">
        {series.map((point) => (
          <div key={point.bucket} className="group relative flex-1">
            <div
              className="w-full rounded-t-sm bg-primary/25 transition-all group-hover:bg-primary/40"
              style={{ height: `${Math.max(point.sessions > 0 ? 3 : 0, (point.sessions / max) * 160)}px` }}
              title={`${label(point.bucket)} · ${nf.format(point.sessions)} sessions · ${nf.format(point.signups)} inscriptions`}
            />
            <div
              className="absolute bottom-0 w-full rounded-t-sm bg-primary transition-all"
              style={{ height: `${Math.max(point.signups > 0 ? 3 : 0, (point.signups / max) * 160)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary/25" /> Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary" /> Comptes créés
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recommandations                                                   */
/* ------------------------------------------------------------------ */

const SEVERITY_STYLES: Record<LandingRecommendation["severity"], string> = {
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  opportunity: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const SEVERITY_LABELS: Record<LandingRecommendation["severity"], string> = {
  info: "Information",
  opportunity: "Opportunité",
  warning: "Point de friction",
};

function RecommendationCard({
  reco,
  onApply,
  onDismiss,
  busy,
}: {
  reco: LandingRecommendation;
  onApply: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const applicable =
    reco.status === "open" && typeof reco.patch === "object" && (reco.patch as { type?: string }).type !== "none";
  return (
    <article
      className={cn(
        "rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-sm",
        reco.status !== "open" && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", SEVERITY_STYLES[reco.severity])}>
          {SEVERITY_LABELS[reco.severity]}
        </span>
        {reco.impact > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            impact estimé +{reco.impact.toFixed(1).replace(".", ",")} %
          </span>
        ) : null}
        {reco.confidence > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
            confiance {(reco.confidence * 100).toFixed(0)} %
          </span>
        ) : null}
        {reco.status === "applied" ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Appliquée · version {reco.appliedVersion ?? "?"}
          </span>
        ) : null}
        {reco.status === "dismissed" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Écartée</span>
        ) : null}
        <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(reco.createdAt)}</span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground">{reco.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{reco.detail}</p>

      {reco.status === "open" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {applicable ? (
            <Button size="sm" onClick={onApply} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Appliquer
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Recommandation informative — aucune modification automatique.
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
            <X className="size-4" /> Écarter
          </Button>
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Tableau de bord                                                   */
/* ------------------------------------------------------------------ */

export function LandingIntelligence({ initial }: { initial: LandingSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [range, setRange] = useState<LandingRange>(initial.range);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async (next: LandingRange) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/landing?range=${next}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Lecture impossible.");
      const data = (await response.json()) as LandingSnapshot;
      setSnapshot(data);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error(e instanceof Error ? e.message : "Lecture impossible.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Rafraîchissement discret : les chiffres du direct restent à jour.
  useEffect(() => {
    const id = window.setInterval(() => void load(range), 45_000);
    return () => window.clearInterval(id);
  }, [load, range]);

  const changeRange = (next: LandingRange) => {
    setRange(next);
    void load(next);
  };

  const runAction = (
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
    id?: string
  ) => {
    setBusyId(id ?? "global");
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        await load(range);
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
    });
  };

  const { kpis, config, recommendations } = snapshot;
  const openRecommendations = recommendations.filter((r) => r.status === "open");

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Sparkles className="size-5 text-primary" />
            Landing Intelligence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            La vitrine s&apos;adapte au profil de chaque visiteur, teste ses variantes en continu et
            apprend de ce qui convertit vraiment. Version en ligne :{" "}
            <span className="font-medium text-foreground tabular-nums">n° {config.version}</span> · objectif
            optimisé : <span className="font-medium text-foreground">{OBJECTIVE_LABELS[snapshot.objective]}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            {LANDING_RANGES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeRange(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {RANGE_LABELS[value]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load(range)} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Bandeau moteur */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <BrainCircuit className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Pilote automatique</p>
            <p className="text-xs text-muted-foreground">
              Déplace le trafic vers les meilleures variantes, sans jamais en arrêter aucune
              (plancher : {Math.round(config.explorationFloor * 100)} % par variante).
            </p>
          </div>
        </div>
        <Switch
          checked={config.autopilot}
          disabled={pending}
          onCheckedChange={(checked) =>
            runAction(() => updateLandingSettings({ autopilot: Boolean(checked) }))
          }
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => runAction(() => runLandingAnalysis())} disabled={pending}>
            <Activity className="size-4" /> Analyser maintenant
          </Button>
          <Button size="sm" variant="outline" onClick={() => runAction(() => rebalanceLandingWeights())} disabled={pending}>
            <Zap className="size-4" /> Rééquilibrer
          </Button>
          <Button size="sm" variant="outline" onClick={() => runAction(() => composeBestLanding())} disabled={pending}>
            <Sparkles className="size-4" /> Composer la meilleure combinaison
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sessions mesurées"
          value={nf.format(kpis.sessions)}
          hint={`${nf.format(kpis.visitors)} visiteurs · ${nf.format(kpis.liveSessions)} en ligne`}
          icon={Users}
        />
        <StatCard
          label="Taux d'engagement"
          value={ratio(kpis.engaged, kpis.sessions)}
          hint={`${nf.format(kpis.bounced)} sessions sans interaction`}
          icon={MousePointerClick}
        />
        <StatCard
          label="Taux d'inscription"
          value={ratio(kpis.signups, kpis.sessions)}
          hint={`${nf.format(kpis.signups)} comptes créés · ${nf.format(kpis.signupStarted)} démarrées`}
          icon={TrendingUp}
        />
        <StatCard
          label="Taux de paiement"
          value={ratio(kpis.payments, kpis.sessions)}
          hint={`${nf.format(kpis.payments)} paiements confirmés`}
          icon={Check}
        />
        <StatCard
          label="Temps moyen sur la page"
          value={duration(kpis.avgDwell)}
          hint={`Scroll médian ${Math.round(kpis.medianScroll)} %`}
          icon={Clock}
        />
        <StatCard
          label="Clic sur un appel à l'action"
          value={ratio(kpis.ctaClicks, kpis.sessions)}
          hint={`${nf.format(kpis.ctaClicks)} sessions avec clic`}
          icon={MousePointerClick}
        />
        <StatCard
          label="Visiteurs déjà venus"
          value={ratio(kpis.returning, kpis.sessions)}
          hint={`${nf.format(kpis.returning)} sessions`}
          icon={RefreshCw}
        />
        <StatCard
          label="Recommandations ouvertes"
          value={nf.format(openRecommendations.length)}
          hint={
            openRecommendations.length > 0
              ? "À examiner dans l'onglet Recommandations"
              : "Rien à signaler pour l'instant"
          }
          icon={Sparkles}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="reco">
            Recommandations
            {openRecommendations.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[11px] font-medium text-primary tabular-nums">
                {openRecommendations.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="variants">Variantes</TabsTrigger>
          <TabsTrigger value="perso">Personnalisation</TabsTrigger>
          <TabsTrigger value="behaviour">Comportement</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="content">Contenu</TabsTrigger>
        </TabsList>

        {/* ---------------- Vue d'ensemble ---------------- */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-sm font-semibold text-foreground">Tunnel de conversion</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reconstruit à partir des sessions réelles. Les trois dernières étapes sont confirmées
                côté serveur (session vérifiée, webhook Stripe signé).
              </p>
              <div className="mt-4">
                <Funnel steps={snapshot.funnel} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h2 className="text-sm font-semibold text-foreground">Évolution</h2>
                <div className="mt-4">
                  <EvolutionChart series={snapshot.series} range={range} />
                </div>
              </div>

              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h2 className="text-sm font-semibold text-foreground">Provenance des visiteurs</h2>
                <div className="mt-3 space-y-2">
                  {snapshot.segments.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Aucune donnée.</p>
                  ) : (
                    snapshot.segments.slice(0, 8).map((segment) => {
                      const max = Math.max(...snapshot.segments.map((s) => s.sessions), 1);
                      const label =
                        SEGMENT_LABELS[segment.segment as keyof typeof SEGMENT_LABELS] ?? segment.segment;
                      return (
                        <div key={segment.segment}>
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-medium text-foreground">{label}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {nf.format(segment.sessions)} · {ratio(segment.signups, segment.sessions)} inscrits
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-[width] duration-700"
                              style={{ width: `${(segment.sessions / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-semibold text-foreground">Activité en direct</h2>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {snapshot.live.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Rien pour l&apos;instant. Les événements apparaîtront dès la première visite.
                </p>
              ) : (
                snapshot.live.map((event, index) => (
                  <div
                    key={`${event.at}-${index}`}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {new Date(event.at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}
                    </span>
                    <span className="font-medium text-foreground">{event.type}</span>
                    {event.section ? <span className="text-muted-foreground">· {event.section}</span> : null}
                    {event.element ? <span className="text-muted-foreground">· {event.element}</span> : null}
                    <span className="ml-auto text-muted-foreground">
                      {event.segment ? SEGMENT_LABELS[event.segment as keyof typeof SEGMENT_LABELS] ?? event.segment : "—"}
                      {event.device ? ` · ${event.device}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Recommandations ---------------- */}
        <TabsContent value="reco" className="mt-4 space-y-3">
          {recommendations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <Info className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Aucune recommandation pour l&apos;instant</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Le moteur ne propose une amélioration que lorsque les données la justifient.
                  Lancez « Analyser maintenant » pour relancer l&apos;analyse sur les 30 derniers jours.
                </p>
              </div>
            </div>
          ) : (
            recommendations.map((reco) => (
              <RecommendationCard
                key={reco.id}
                reco={reco}
                busy={busyId === reco.id}
                onApply={() => runAction(() => applyLandingRecommendation(reco.id), reco.id)}
                onDismiss={() => runAction(() => dismissLandingRecommendation(reco.id), reco.id)}
              />
            ))
          )}
        </TabsContent>

        {/* ---------------- Autres onglets ---------------- */}
        <TabsContent value="variants" className="mt-4">
          <LandingVariantsPanel snapshot={snapshot} onAction={runAction} busy={pending} />
        </TabsContent>
        <TabsContent value="perso" className="mt-4">
          <LandingPersonalizationPanel snapshot={snapshot} onAction={runAction} busy={pending} />
        </TabsContent>
        <TabsContent value="behaviour" className="mt-4">
          <LandingBehaviourPanel snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <LandingHistoryPanel snapshot={snapshot} onAction={runAction} busy={pending} />
        </TabsContent>
        <TabsContent value="content" className="mt-4">
          <LandingContentPanel snapshot={snapshot} onAction={runAction} busy={pending} />
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ChevronRight className="size-3.5" />
        Mesure anonyme et sans cookie tiers : identifiant aléatoire, coordonnées de clic relatives,
        aucune donnée personnelle. Dernière lecture {relativeTime(snapshot.generatedAt)}.
      </p>
    </div>
  );
}
