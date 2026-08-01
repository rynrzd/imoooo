"use client";

import { useState } from "react";
import {
  History,
  Lock,
  MousePointerClick,
  Plus,
  Quote,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/admin/types";
import {
  deleteLandingRule,
  pinLandingVariant,
  resetLandingConfig,
  rollbackLandingVersion,
  saveLandingRule,
  saveLandingTestimonials,
  updateLandingSettings,
} from "@/lib/landing/actions";
import { LANDING_SLOTS, SLOT_ORDER, getVariant } from "@/lib/landing/catalog";
import { normalizeWeights } from "@/lib/landing/assign";
import { candidateKeys } from "@/lib/landing/resolve";
import { MIN_SESSIONS_FOR_SCORE } from "@/lib/landing/scoring";
import type { LandingSnapshot } from "@/lib/landing/queries";
import {
  SECTION_LABELS,
  SEGMENT_KEYS,
  SEGMENT_LABELS,
  type SectionKey,
  type SlotKey,
  type Testimonial,
} from "@/lib/landing/types";
import { cn } from "@/lib/utils";

/**
 * Landing Intelligence — panneaux détaillés de l'administration.
 *
 * Variantes, personnalisation, comportement, historique et contenu.
 * Toutes les actions passent par les Server Actions (rôle vérifié en base) et
 * créent une version restaurable.
 */

export type LandingActionRunner = (action: () => Promise<ActionResult>, id?: string) => void;

const nf = new Intl.NumberFormat("fr-FR");
const percent = (value: number) => `${Math.round(value * 100)} %`;

function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1).replace(".", ",")} %`;
}

function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ================================================================== */
/*  Variantes                                                          */
/* ================================================================== */

function ScoreBadge({ score, sufficient }: { score: number; sufficient: boolean }) {
  if (!sufficient) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        données insuffisantes
      </span>
    );
  }
  const tone =
    score >= 9.5
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : score >= 8
        ? "bg-primary/15 text-primary"
        : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", tone)}>
      {score.toFixed(1).replace(".", ",")}/10
    </span>
  );
}

export function LandingVariantsPanel({
  snapshot,
  onAction,
  busy,
}: {
  snapshot: LandingSnapshot;
  onAction: LandingActionRunner;
  busy: boolean;
}) {
  const { config, capabilities, scores } = snapshot;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Le score est relatif à la meilleure variante de l&apos;emplacement, calculé sur les
        conversions réelles avec un rétrécissement bayésien : une variante peu vue ne peut pas
        passer devant une variante très vue sur un coup de chance. Il n&apos;apparaît qu&apos;à
        partir de {MIN_SESSIONS_FOR_SCORE} sessions.
      </p>

      {SLOT_ORDER.map((slot) => {
        const definition = LANDING_SLOTS[slot];
        const keys = candidateKeys(slot, config, capabilities);
        const weights = normalizeWeights(keys, config.weights[slot], config.explorationFloor);
        const slotScores = scores[slot] ?? [];
        const pinned = config.pins[slot];

        return (
          <Panel
            key={slot}
            title={definition.label}
            description={definition.description}
            actions={
              pinned ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onAction(() => pinLandingVariant(slot, null))}
                >
                  <Unlock className="size-4" /> Relancer le test
                </Button>
              ) : null
            }
          >
            <div className="space-y-2">
              {keys.map((key) => {
                const variant = getVariant(slot, key);
                const stat = slotScores.find((s) => s.variant === key);
                const share = pinned ? (pinned === key ? 1 : 0) : (weights[key] ?? 0);
                const isCustomOrder = !variant && slot === "section_order";
                return (
                  <div key={key} className="rounded-lg border border-border/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {variant?.label ?? key}
                      </span>
                      {isCustomOrder ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          composé par le moteur
                        </span>
                      ) : null}
                      {pinned === key ? (
                        <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                          <Lock className="size-3" /> figée
                        </span>
                      ) : null}
                      {stat ? <ScoreBadge score={stat.score} sufficient={stat.dataSufficient} /> : null}
                      <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span>{nf.format(stat?.sessions ?? 0)} sessions</span>
                        <span>{stat ? rate(stat.successes, stat.sessions) : "—"}</span>
                        {!pinned ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onAction(() => pinLandingVariant(slot, key))}
                            title="Figer cette variante pour tous les visiteurs"
                          >
                            <Lock className="size-3.5" />
                          </Button>
                        ) : null}
                      </span>
                    </div>

                    {variant?.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{variant.description}</p>
                    ) : null}
                    {isCustomOrder && config.customOrders[key] ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {config.customOrders[key]!.map((s: SectionKey) => SECTION_LABELS[s]).join(" → ")}
                      </p>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-700"
                          style={{ width: `${Math.max(share * 100, 1)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-[11px] text-muted-foreground tabular-nums">
                        {percent(share)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Personnalisation                                                   */
/* ================================================================== */

const DEVICE_LABELS: Record<string, string> = {
  "": "Tous les appareils",
  mobile: "Mobile",
  tablet: "Tablette",
  desktop: "Ordinateur",
};

export function LandingPersonalizationPanel({
  snapshot,
  onAction,
  busy,
}: {
  snapshot: LandingSnapshot;
  onAction: LandingActionRunner;
  busy: boolean;
}) {
  const { config, capabilities } = snapshot;
  const [segment, setSegment] = useState<string>("tiktok");
  const [device, setDevice] = useState<string>("");
  const [slot, setSlot] = useState<SlotKey>("hero_headline");
  const [variant, setVariant] = useState<string>(
    candidateKeys("hero_headline", config, capabilities)[0] ?? ""
  );
  const [holdout, setHoldout] = useState(String(Math.round(config.ruleHoldout * 100)));
  const [floor, setFloor] = useState(String(Math.round(config.explorationFloor * 100)));

  const variantChoices = candidateKeys(slot, config, capabilities);

  return (
    <div className="space-y-4">
      <Panel
        title="Règles de personnalisation"
        description="Pour un profil donné, servir une variante précise. La règle la plus précise l'emporte (segment + appareil > segment > appareil seul)."
      >
        {config.rules.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune règle active.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Profil</th>
                  <th className="pb-2 font-medium">Emplacement</th>
                  <th className="pb-2 font-medium">Variante servie</th>
                  <th className="pb-2 font-medium">Origine</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {config.rules.map((rule, index) => (
                  <tr key={`${rule.segment}-${rule.device ?? ""}-${rule.slot}-${index}`}>
                    <td className="py-2 font-medium text-foreground">
                      {rule.segment === "any"
                        ? "Tous les visiteurs"
                        : SEGMENT_LABELS[rule.segment]}
                      {rule.device ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · {DEVICE_LABELS[rule.device]}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-muted-foreground">{LANDING_SLOTS[rule.slot].label}</td>
                    <td className="py-2 text-muted-foreground">
                      {getVariant(rule.slot, rule.variant)?.label ?? rule.variant}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {rule.origin === "default"
                        ? "par défaut"
                        : rule.origin === "recommendation"
                          ? "recommandation"
                          : "manuelle"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          onAction(() =>
                            deleteLandingRule({
                              segment: rule.segment,
                              device: rule.device ?? null,
                              slot: rule.slot,
                            })
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">Segment</Label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="any">Tous les visiteurs</option>
              {SEGMENT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SEGMENT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Appareil</Label>
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {Object.entries(DEVICE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Emplacement</Label>
            <select
              value={slot}
              onChange={(e) => {
                const next = e.target.value as SlotKey;
                setSlot(next);
                setVariant(candidateKeys(next, config, capabilities)[0] ?? "");
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {SLOT_ORDER.map((key) => (
                <option key={key} value={key}>
                  {LANDING_SLOTS[key].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Variante</Label>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {variantChoices.map((key) => (
                <option key={key} value={key}>
                  {getVariant(slot, key)?.label ?? key}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={busy || !variant}
              onClick={() => onAction(() => saveLandingRule({ segment, device: device || null, slot, variant }))}
            >
              <Plus className="size-4" /> Ajouter
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Réglages d'apprentissage"
        description="Deux garde-fous : une part minimale garantie à chaque variante (le moteur n'arrête jamais d'apprendre) et un groupe témoin qui ignore les règles (pour mesurer si la personnalisation sert vraiment)."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="floor" className="text-xs">
              Plancher d&apos;exploration (%)
            </Label>
            <Input
              id="floor"
              inputMode="numeric"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="holdout" className="text-xs">
              Groupe témoin (%)
            </Label>
            <Input
              id="holdout"
              inputMode="numeric"
              value={holdout}
              onChange={(e) => setHoldout(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                onAction(() =>
                  updateLandingSettings({
                    explorationFloor: Math.min(50, Math.max(2, Number(floor) || 8)) / 100,
                    ruleHoldout: Math.min(50, Math.max(0, Number(holdout) || 0)) / 100,
                  })
                )
              }
            >
              <Save className="size-4" /> Enregistrer
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ================================================================== */
/*  Comportement                                                       */
/* ================================================================== */

const HEAT_COLS = 24;
const HEAT_ROWS = 40;

export function LandingBehaviourPanel({ snapshot }: { snapshot: LandingSnapshot }) {
  const maxHeat = Math.max(1, ...snapshot.heatmap.map((c) => c.count));
  const totalClicks = snapshot.heatmap.reduce((sum, c) => sum + c.count, 0);
  const cells = new Map(snapshot.heatmap.map((c) => [`${c.x}:${c.y}`, c.count]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Carte de scroll"
          description="Part des sessions ayant atteint chaque profondeur de page."
        >
          {snapshot.scrollmap.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune donnée.</p>
          ) : (
            <div className="space-y-3">
              {snapshot.scrollmap.map((point) => (
                <div key={point.depth}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-foreground tabular-nums">{point.depth} % de la page</span>
                    <span className="text-muted-foreground tabular-nums">
                      {nf.format(point.sessions)} sessions · {point.ratio.toFixed(1).replace(".", ",")} %
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary transition-[width] duration-700"
                      style={{ width: `${point.ratio}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    mobile {nf.format(point.mobile)} · ordinateur {nf.format(point.desktop)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Heatmap des clics"
          description={`Positions relatives des clics sur la page (${nf.format(totalClicks)} clics). Aucune coordonnée absolue, aucune capture d'écran.`}
        >
          {totalClicks === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun clic mesuré.</p>
          ) : (
            <div
              className="grid overflow-hidden rounded-lg border border-border bg-muted/30"
              style={{
                gridTemplateColumns: `repeat(${HEAT_COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${HEAT_ROWS}, 8px)`,
              }}
            >
              {Array.from({ length: HEAT_COLS * HEAT_ROWS }).map((_, index) => {
                const x = index % HEAT_COLS;
                const y = Math.floor(index / HEAT_COLS);
                const count = cells.get(`${x}:${y}`) ?? 0;
                if (count === 0) return <span key={index} />;
                const intensity = Math.min(1, count / maxHeat);
                return (
                  <span
                    key={index}
                    title={`${count} clic${count > 1 ? "s" : ""}`}
                    style={{
                      backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(20 + intensity * 80)}%, transparent)`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Sections : ce qui retient, ce qui perd"
        description="« Sorties sans clic » = sessions dont la dernière section vue est celle-ci et qui n'ont jamais cliqué sur un appel à l'action."
      >
        {snapshot.sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune donnée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Section</th>
                  <th className="pb-2 text-right font-medium">Sessions</th>
                  <th className="pb-2 text-right font-medium">Temps moyen</th>
                  <th className="pb-2 text-right font-medium">Sorties sans clic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshot.sections.map((section) => (
                  <tr key={section.section}>
                    <td className="py-2 font-medium text-foreground">
                      {SECTION_LABELS[section.section as SectionKey] ?? section.section}
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {nf.format(section.sessions)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {section.avgDwell ? `${section.avgDwell.toString().replace(".", ",")} s` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          section.exitsWithoutCta / Math.max(section.sessions, 1) >= 0.3
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {nf.format(section.exitsWithoutCta)} · {rate(section.exitsWithoutCta, section.sessions)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Éléments les plus cliqués">
          {snapshot.elements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun clic instrumenté.</p>
          ) : (
            <ul className="space-y-1.5">
              {snapshot.elements.map((element) => (
                <li key={element.element} className="flex items-center gap-2 text-sm">
                  <MousePointerClick className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-foreground">{element.element}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {nf.format(element.clicks)} clics · {nf.format(element.sessions)} sessions
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Appareils">
          {snapshot.devices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune donnée.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Appareil</th>
                  <th className="pb-2 text-right font-medium">Sessions</th>
                  <th className="pb-2 text-right font-medium">Scroll moyen</th>
                  <th className="pb-2 text-right font-medium">Inscriptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshot.devices.map((device) => (
                  <tr key={device.device}>
                    <td className="py-2 font-medium text-foreground">
                      {DEVICE_LABELS[device.device] ?? device.device}
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {nf.format(device.sessions)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {Math.round(device.avgScroll)} %
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {rate(device.signups, device.sessions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Historique                                                         */
/* ================================================================== */

const ORIGIN_LABELS: Record<string, string> = {
  manual: "Manuel",
  recommendation: "Recommandation",
  autopilot: "Pilote automatique",
  rollback: "Retour arrière",
  compose: "Combinaison composée",
};

export function LandingHistoryPanel({
  snapshot,
  onAction,
  busy,
}: {
  snapshot: LandingSnapshot;
  onAction: LandingActionRunner;
  busy: boolean;
}) {
  return (
    <Panel
      title="Historique des versions"
      description="Chaque modification crée une version. Le retour arrière republie l'ancienne configuration sans effacer l'historique."
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onAction(() => resetLandingConfig())}
        >
          <RotateCcw className="size-4" /> Réinitialiser
        </Button>
      }
    >
      {snapshot.versions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucune version enregistrée : la vitrine tourne sur sa configuration d&apos;origine.
        </p>
      ) : (
        <ol className="space-y-2">
          {snapshot.versions.map((version) => {
            const isLive = version.version === snapshot.config.version;
            return (
              <li
                key={version.id}
                className={cn(
                  "rounded-lg border p-3",
                  isLive ? "border-primary/40 bg-primary/5" : "border-border/70"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <History className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    Version {version.version}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {ORIGIN_LABELS[version.origin] ?? version.origin}
                  </span>
                  {isLive ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      en ligne
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-foreground">{version.label || "Modification"}</p>
                {version.reason ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{version.reason}</p>
                ) : null}
                {!isLive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => onAction(() => rollbackLandingVersion(version.id))}
                  >
                    <RotateCcw className="size-3.5" /> Restaurer cette version
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ================================================================== */
/*  Contenu                                                            */
/* ================================================================== */

export function LandingContentPanel({
  snapshot,
  onAction,
  busy,
}: {
  snapshot: LandingSnapshot;
  onAction: LandingActionRunner;
  busy: boolean;
}) {
  const [items, setItems] = useState<Testimonial[]>(
    snapshot.capabilities.testimonials.length > 0
      ? snapshot.capabilities.testimonials
      : [{ quote: "", author: "", role: "" }]
  );

  const update = (index: number, field: keyof Testimonial, value: string) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Vidéo de présentation"
        description="Utilisée par la variante « Vidéo » du hero. Elle se publie depuis Entreprise → Vidéo."
      >
        <div className="flex items-center gap-3 text-sm">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-lg",
              snapshot.capabilities.videoUrl ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Video className="size-4.5" />
          </span>
          <div>
            <p className="font-medium text-foreground">
              {snapshot.capabilities.videoUrl ? "Vidéo publiée" : "Aucune vidéo publiée"}
            </p>
            <p className="text-xs text-muted-foreground">
              {snapshot.capabilities.videoUrl
                ? "La variante vidéo participe à l'expérimentation."
                : "La variante vidéo est automatiquement retirée de l'expérimentation."}
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Témoignages réels"
        description="Nireo n'affiche jamais de témoignage inventé. Tant qu'il y en a moins de deux, la variante « Témoignages » du bloc de réassurance reste hors expérimentation."
        actions={
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onAction(() => saveLandingTestimonials(items))}
          >
            <Save className="size-4" /> Enregistrer
          </Button>
        }
      >
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-border/70 p-3">
              <div className="flex items-center gap-2">
                <Quote className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Témoignage {index + 1}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <textarea
                value={item.quote}
                onChange={(e) => update(index, "quote", e.target.value)}
                rows={2}
                placeholder="Ce que la personne a réellement dit"
                className="mt-2 w-full rounded-md border border-input bg-transparent p-2 text-sm"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  value={item.author}
                  onChange={(e) => update(index, "author", e.target.value)}
                  placeholder="Prénom Nom"
                />
                <Input
                  value={item.role}
                  onChange={(e) => update(index, "role", e.target.value)}
                  placeholder="Propriétaire à Lyon · 4 logements"
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((current) => [...current, { quote: "", author: "", role: "" }])}
          >
            <Plus className="size-4" /> Ajouter un témoignage
          </Button>
        </div>
      </Panel>
    </div>
  );
}
