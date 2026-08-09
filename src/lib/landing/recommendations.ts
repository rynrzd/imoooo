import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { defaultSectionOrder, getSlot, getVariant, LANDING_SLOTS } from "./catalog";
import type { LandingPatch } from "./patch";
import {
  rangeWindow,
  type DeviceStat,
  type LandingKpis,
  type SectionStat,
  type SegmentVariantStat,
} from "./queries";
import {
  MIN_SESSIONS_FOR_SCORE,
  OBJECTIVE_LABELS,
  pickObjective,
  probabilityToBeat,
  scoreSlot,
  successesOf,
  type Objective,
  type VariantStat,
} from "./scoring";
import { SECTION_LABELS, SEGMENT_LABELS, isSectionKey, isSlotKey, type LandingCapabilities, type LandingConfig, type SectionKey, type SegmentKey, type SlotKey } from "./types";

/**
 * Landing Intelligence — MOTEUR DE RECOMMANDATIONS.
 *
 * Analyse les mesures RÉELLES et propose des améliorations. Chaque
 * recommandation porte :
 *   - un « pourquoi » chiffré (les données qui la déclenchent) ;
 *   - un patch applicable en un clic, borné au catalogue validé ;
 *   - une estimation d'impact et un niveau de confiance statistique.
 *
 * Aucune recommandation n'est appliquée automatiquement : l'administration
 * garde la décision. Le seul automatisme possible est le rééquilibrage des
 * poids entre variantes déjà validées (pilote automatique).
 */

export interface GeneratedRecommendation {
  key: string;
  kind: string;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  patch: LandingPatch;
  /** Gain relatif estimé sur l'objectif courant, en %. */
  impact: number;
  /** Probabilité que l'effet observé ne soit pas dû au hasard (0–1). */
  confidence: number;
  severity: "info" | "opportunity" | "warning";
}

export interface AnalysisInput {
  kpis: LandingKpis;
  variants: VariantStat[];
  segmentVariants: SegmentVariantStat[];
  sections: SectionStat[];
  devices: DeviceStat[];
  personalization: {
    personalized: { sessions: number; engaged: number; ctaClicks: number; signups: number };
    control: { sessions: number; engaged: number; ctaClicks: number; signups: number };
  } | null;
  config: LandingConfig;
  capabilities: LandingCapabilities;
}

const pct = (value: number) => `${(value * 100).toFixed(1).replace(".", ",")} %`;
const nf = new Intl.NumberFormat("fr-FR");

/** Sessions minimales avant de tirer la moindre conclusion. */
const MIN_TOTAL_SESSIONS = 60;

/* ------------------------------------------------------------------ */
/*  Analyse                                                            */
/* ------------------------------------------------------------------ */

/** Fonction PURE : mêmes chiffres ⇒ mêmes recommandations. */
export function analyse(input: AnalysisInput): GeneratedRecommendation[] {
  const out: GeneratedRecommendation[] = [];
  const objective = pickObjective(input.variants);
  const objectiveLabel = OBJECTIVE_LABELS[objective];
  const totalSessions = input.kpis.sessions;

  // --- 0. Volume de données ---------------------------------------
  if (totalSessions < MIN_TOTAL_SESSIONS) {
    out.push({
      key: "low_traffic",
      kind: "data",
      title: "Trop peu de trafic pour conclure",
      detail:
        `${nf.format(totalSessions)} session${totalSessions > 1 ? "s" : ""} mesurée${totalSessions > 1 ? "s" : ""} sur la période. ` +
        `Le moteur continue de répartir le trafic équitablement entre les variantes et n'annoncera de gagnante qu'à partir de ` +
        `${MIN_SESSIONS_FOR_SCORE} sessions par variante. Aucun score n'est publié tant que l'échantillon est trop petit.`,
      evidence: { sessions: totalSessions, required: MIN_TOTAL_SESSIONS },
      patch: { type: "none" },
      impact: 0,
      confidence: 1,
      severity: "info",
    });
  }

  // --- 1. Gagnantes par slot --------------------------------------
  const bySlot = new Map<SlotKey, VariantStat[]>();
  for (const stat of input.variants) {
    if (!isSlotKey(stat.slot)) continue;
    const list = bySlot.get(stat.slot) ?? [];
    list.push(stat);
    bySlot.set(stat.slot, list);
  }

  for (const [slot, stats] of bySlot) {
    if (stats.length < 2) continue;
    // Seules les variantes réellement mesurées peuvent être comparées : une
    // variante à peine servie ne déclenche jamais de recommandation.
    const scores = scoreSlot(stats, objective)
      .filter((s) => s.dataSufficient)
      .sort((a, b) => b.adjustedRate - a.adjustedRate);
    if (scores.length < 2) continue;
    const top = scores[0]!;
    const runnerUp = scores[1]!;
    if (top.probabilityBest < 0.9) continue;

    const lift = runnerUp.adjustedRate > 0 ? top.adjustedRate / runnerUp.adjustedRate - 1 : 0;
    if (lift < 0.03) continue; // écart négligeable : on laisse tourner

    const currentWeight = input.config.weights[slot]?.[top.variant];
    const totalWeight = Object.values(input.config.weights[slot] ?? {}).reduce((a, b) => a + b, 0);
    const share = totalWeight > 0 && currentWeight ? currentWeight / totalWeight : 1 / stats.length;
    if (share >= 0.55) continue; // déjà majoritaire

    const slotDef = getSlot(slot);
    const topLabel = getVariant(slot, top.variant)?.label ?? top.variant;
    const runnerLabel = getVariant(slot, runnerUp.variant)?.label ?? runnerUp.variant;

    out.push({
      key: `winner:${slot}:${top.variant}`,
      kind: "variant_winner",
      title: `« ${topLabel} » devance les autres versions de « ${slotDef.label} »`,
      detail:
        `Sur ${nf.format(top.sessions)} sessions, « ${topLabel} » obtient ${pct(top.rate)} de ${objectiveLabel} ` +
        `contre ${pct(runnerUp.rate)} pour « ${runnerLabel} » (${nf.format(runnerUp.sessions)} sessions). ` +
        `La probabilité qu'elle soit réellement la meilleure est de ${pct(top.probabilityBest)}. ` +
        `Appliquer augmente sa part de trafic sans jamais arrêter les autres : le moteur continue d'apprendre.`,
      evidence: {
        slot,
        objectif: objectiveLabel,
        gagnante: { variante: topLabel, sessions: top.sessions, taux: top.rate, score: top.score },
        seconde: { variante: runnerLabel, sessions: runnerUp.sessions, taux: runnerUp.rate },
        partActuelle: share,
      },
      patch: { type: "boost", slot, variant: top.variant, share: 0.6 },
      impact: Math.round(lift * 1000) / 10,
      confidence: top.probabilityBest,
      severity: "opportunity",
    });
  }

  // --- 2. Personnalisation par segment ----------------------------
  const segmentGroups = new Map<string, SegmentVariantStat[]>();
  for (const row of input.segmentVariants) {
    const id = `${row.segment}:${row.slot}`;
    const list = segmentGroups.get(id) ?? [];
    list.push(row);
    segmentGroups.set(id, list);
  }

  for (const [id, rows] of segmentGroups) {
    if (rows.length < 2) continue;
    const [segment, slot] = id.split(":") as [SegmentKey, SlotKey];
    if (!isSlotKey(slot)) continue;

    const success = (r: SegmentVariantStat) =>
      objective === "signups" || objective === "payments"
        ? r.signups
        : objective === "ctaClicks"
          ? r.ctaClicks
          : r.engaged;

    const ranked = [...rows].sort(
      (a, b) => (success(b) + 1) / (b.sessions + 2) - (success(a) + 1) / (a.sessions + 2)
    );
    const best = ranked[0]!;
    const rest = ranked.slice(1);
    if (best.sessions < 25) continue;

    const others = rest.reduce(
      (acc, r) => ({ successes: acc.successes + success(r), trials: acc.trials + r.sessions }),
      { successes: 0, trials: 0 }
    );
    if (others.trials < 25) continue;

    const confidence = probabilityToBeat(
      { successes: success(best), trials: best.sessions },
      others
    );
    if (confidence < 0.85) continue;

    const bestRate = (success(best) + 1) / (best.sessions + 2);
    const otherRate = (others.successes + 1) / (others.trials + 2);
    const lift = otherRate > 0 ? bestRate / otherRate - 1 : 0;
    if (lift < 0.08) continue;

    // Déjà couvert par une règle identique ?
    const existing = input.config.rules.find(
      (r) => r.segment === segment && !r.device && r.slot === slot
    );
    if (existing?.variant === best.variant) continue;

    const label = getVariant(slot, best.variant)?.label ?? best.variant;
    const segmentLabel = SEGMENT_LABELS[segment] ?? segment;
    out.push({
      key: `segment:${segment}:${slot}:${best.variant}`,
      kind: "segment_rule",
      title: `Les visiteurs « ${segmentLabel} » réagissent mieux à « ${label} »`,
      detail:
        `Dans ce segment, « ${label} » obtient ${pct(bestRate)} de ${objectiveLabel} sur ${nf.format(best.sessions)} sessions, ` +
        `contre ${pct(otherRate)} pour les autres versions de « ${LANDING_SLOTS[slot].label} » (${nf.format(others.trials)} sessions). ` +
        `Appliquer crée une règle de personnalisation pour ce segment uniquement — le reste du trafic continue d'être testé normalement.`,
      evidence: {
        segment,
        slot,
        variante: label,
        sessions: best.sessions,
        tauxSegment: bestRate,
        tauxAutres: otherRate,
        objectif: objectiveLabel,
      },
      patch: { type: "rule", segment, device: null, slot, variant: best.variant },
      impact: Math.round(lift * 1000) / 10,
      confidence,
      severity: "opportunity",
    });
  }

  // --- 3. Abandon sur une section ---------------------------------
  const measured = input.sections.filter((s) => s.sessions >= 40 && isSectionKey(s.section));
  if (measured.length >= 3) {
    const worst = [...measured].sort(
      (a, b) => b.exitsWithoutCta / b.sessions - a.exitsWithoutCta / a.sessions
    )[0]!;
    const exitRate = worst.exitsWithoutCta / worst.sessions;
    const order = defaultSectionOrder();
    const position = order.indexOf(worst.section as SectionKey);
    if (exitRate >= 0.3 && position >= 0 && position < order.length - 2) {
      // On propose de repousser la section qui perd les visiteurs, pour que
      // les sections qui convertissent arrivent plus tôt.
      const next: SectionKey[] = order.filter((s) => s !== worst.section);
      next.splice(Math.min(next.length, position + 3), 0, worst.section as SectionKey);
      const label = SECTION_LABELS[worst.section as SectionKey] ?? worst.section;
      out.push({
        key: `section_exit:${worst.section}`,
        kind: "section_reorder",
        title: `${pct(exitRate)} des visiteurs s'arrêtent sur « ${label} »`,
        detail:
          `Sur ${nf.format(worst.sessions)} sessions ayant vu cette section, ${nf.format(worst.exitsWithoutCta)} l'ont quittée ` +
          `sans jamais cliquer sur un appel à l'action, après ${worst.avgDwell.toString().replace(".", ",")} s en moyenne. ` +
          `Appliquer teste un enchaînement où cette section arrive plus tard, sur une partie du trafic seulement.`,
        evidence: {
          section: worst.section,
          sessions: worst.sessions,
          sortiesSansCta: worst.exitsWithoutCta,
          tauxSortie: exitRate,
          tempsMoyen: worst.avgDwell,
          nouvelOrdre: next,
        },
        patch: { type: "order", key: `late-${worst.section}`.slice(0, 40), order: next, share: 0.4 },
        impact: Math.round(exitRate * 100) / 10,
        confidence: Math.min(0.95, worst.sessions / (worst.sessions + 60)),
        severity: "warning",
      });
    }
  }

  // --- 4. Lecture mobile ------------------------------------------
  const mobile = input.devices.find((d) => d.device === "mobile");
  const desktop = input.devices.find((d) => d.device === "desktop");
  if (mobile && desktop && mobile.sessions >= 40 && desktop.sessions >= 40) {
    if (mobile.avgScroll < desktop.avgScroll * 0.75) {
      const already = input.config.rules.find(
        (r) => r.device === "mobile" && r.slot === "section_order"
      );
      if (!already) {
        out.push({
          key: "mobile_scroll",
          kind: "device_rule",
          title: "Les visiteurs mobiles descendent nettement moins bas",
          detail:
            `Profondeur moyenne atteinte : ${mobile.avgScroll.toString().replace(".", ",")} % sur mobile ` +
            `(${nf.format(mobile.sessions)} sessions) contre ${desktop.avgScroll.toString().replace(".", ",")} % sur ordinateur ` +
            `(${nf.format(desktop.sessions)} sessions). Ce qui se trouve en bas de page n'est donc pas vu sur mobile. ` +
            `Appliquer sert aux mobiles un enchaînement qui remonte la démonstration et les tarifs.`,
          evidence: {
            mobile: { sessions: mobile.sessions, scroll: mobile.avgScroll, cta: mobile.ctaClicks },
            ordinateur: { sessions: desktop.sessions, scroll: desktop.avgScroll, cta: desktop.ctaClicks },
          },
          patch: {
            type: "rule",
            segment: "any",
            device: "mobile",
            slot: "section_order",
            variant: "demo_first",
          },
          impact: Math.round((1 - mobile.avgScroll / Math.max(desktop.avgScroll, 1)) * 1000) / 10,
          confidence: 0.9,
          severity: "warning",
        });
      }
    }
  }

  // --- 5. Effet réel de la personnalisation -----------------------
  const perso = input.personalization;
  if (perso && perso.control.sessions >= 40 && perso.personalized.sessions >= 40) {
    const value = (g: { engaged: number; ctaClicks: number; signups: number; sessions: number }) =>
      objective === "signups" || objective === "payments"
        ? g.signups
        : objective === "ctaClicks"
          ? g.ctaClicks
          : g.engaged;
    const a = { successes: value(perso.personalized), trials: perso.personalized.sessions };
    const b = { successes: value(perso.control), trials: perso.control.sessions };
    const rateA = (a.successes + 1) / (a.trials + 2);
    const rateB = (b.successes + 1) / (b.trials + 2);
    const confidence = probabilityToBeat(a, b);
    const lift = rateB > 0 ? rateA / rateB - 1 : 0;

    if (confidence < 0.2 && lift < -0.05) {
      out.push({
        key: "personalization_negative",
        kind: "personalization",
        title: "La personnalisation fait moins bien que le groupe témoin",
        detail:
          `Sessions personnalisées : ${pct(rateA)} de ${objectiveLabel} sur ${nf.format(a.trials)} sessions. ` +
          `Groupe témoin (règles ignorées) : ${pct(rateB)} sur ${nf.format(b.trials)} sessions. ` +
          `Les règles de personnalisation actuelles desservent la conversion : revoyez-les dans l'onglet Personnalisation.`,
        evidence: { personnalise: a, temoin: b, ecart: lift },
        patch: { type: "none" },
        impact: Math.round(Math.abs(lift) * 1000) / 10,
        confidence: 1 - confidence,
        severity: "warning",
      });
    } else if (confidence >= 0.85 && lift > 0.05) {
      out.push({
        key: "personalization_positive",
        kind: "personalization",
        title: "La personnalisation apporte un gain mesurable",
        detail:
          `Sessions personnalisées : ${pct(rateA)} de ${objectiveLabel} contre ${pct(rateB)} pour le groupe témoin. ` +
          `Soit ${(lift * 100).toFixed(1).replace(".", ",")} % de mieux, avec ${pct(confidence)} de certitude. ` +
          `Aucune action nécessaire : c'est la confirmation que les règles servent à quelque chose.`,
        evidence: { personnalise: a, temoin: b, ecart: lift },
        patch: { type: "none" },
        impact: Math.round(lift * 1000) / 10,
        confidence,
        severity: "info",
      });
    }
  }

  // --- 6. Contenus manquants --------------------------------------
  if (input.capabilities.testimonials.length < 2 && totalSessions >= 150) {
    out.push({
      key: "content_testimonials",
      kind: "content",
      title: "Aucun témoignage réel : la variante correspondante est désactivée",
      detail:
        "La variante « Témoignages » du bloc de réassurance n'est jamais servie tant que moins de deux témoignages " +
        "réels sont enregistrés. Ajoutez-les dans l'onglet Contenu — Nireo n'affichera jamais de témoignage inventé.",
      evidence: { temoignages: input.capabilities.testimonials.length },
      patch: { type: "none" },
      impact: 0,
      confidence: 1,
      severity: "info",
    });
  }

  // --- 7. Rebond élevé --------------------------------------------
  if (totalSessions >= 100) {
    const bounceRate = input.kpis.bounced / Math.max(totalSessions, 1);
    if (bounceRate >= 0.6 && !input.config.pins.section_order) {
      out.push({
        key: "bounce_high",
        kind: "engagement",
        title: `${pct(bounceRate)} des visiteurs repartent sans rien explorer`,
        detail:
          `${nf.format(input.kpis.bounced)} sessions sur ${nf.format(totalSessions)} n'ont ni descendu au quart de la page ` +
          `ni passé 10 secondes dessus. La promesse d'ouverture ne retient pas. Appliquer envoie 45 % du trafic vers ` +
          `l'enchaînement « Démonstration d'abord », qui montre le produit immédiatement après le titre.`,
        evidence: {
          sessions: totalSessions,
          rebonds: input.kpis.bounced,
          tauxRebond: bounceRate,
          tempsMoyen: input.kpis.avgDwell,
        },
        patch: { type: "boost", slot: "section_order", variant: "demo_first", share: 0.45 },
        impact: Math.round(bounceRate * 100) / 10,
        confidence: 0.8,
        severity: "warning",
      });
    }
  }

  return out.sort((a, b) => b.impact - a.impact);
}

/* ------------------------------------------------------------------ */
/*  Génération + persistance                                          */
/* ------------------------------------------------------------------ */

/** Fenêtre d'analyse : 30 jours glissants (assez long pour être stable). */
const ANALYSIS_RANGE = "30d" as const;

export interface AnalysisResult {
  created: number;
  updated: number;
  total: number;
  objective: Objective;
  sessions: number;
}

/**
 * Lance une analyse complète et enregistre les recommandations.
 * Les recommandations déjà appliquées ou écartées ne sont jamais ressuscitées.
 */
export async function generateRecommendations(
  config: LandingConfig,
  capabilities: LandingCapabilities
): Promise<AnalysisResult> {
  if (!isAdminConfigured) {
    return { created: 0, updated: 0, total: 0, objective: "engaged", sessions: 0 };
  }
  const admin = createAdminClient();
  const { since } = rangeWindow(ANALYSIS_RANGE);
  const p_since = since.toISOString();

  const [kpis, variants, segmentVariants, sections, devices, personalization] = await Promise.all([
    admin.rpc("landing_kpis", { p_since }),
    admin.rpc("landing_variant_stats", { p_since }),
    admin.rpc("landing_segment_variant_stats", { p_since }),
    admin.rpc("landing_sections", { p_since }),
    admin.rpc("landing_device_stats", { p_since }),
    admin.rpc("landing_personalization_effect", { p_since }),
  ]);

  const firstError =
    kpis.error || variants.error || segmentVariants.error || sections.error || devices.error;
  if (firstError) throw new Error(`Analyse impossible : ${firstError.message}`);

  const input: AnalysisInput = {
    kpis: kpis.data as LandingKpis,
    variants: (variants.data ?? []) as VariantStat[],
    segmentVariants: (segmentVariants.data ?? []) as SegmentVariantStat[],
    sections: (sections.data ?? []) as SectionStat[],
    devices: (devices.data ?? []) as DeviceStat[],
    personalization: (personalization.data ?? null) as AnalysisInput["personalization"],
    config,
    capabilities,
  };

  const generated = analyse(input);

  // État actuel : on ne recrée jamais ce qui a été appliqué ou écarté.
  const { data: existing } = await admin.from("landing_recommendations").select("key, status");
  const known = new Map<string, string>((existing ?? []).map((r) => [r.key as string, r.status as string]));

  let created = 0;
  let updated = 0;
  for (const reco of generated) {
    const status = known.get(reco.key);
    const row = {
      key: reco.key,
      kind: reco.kind,
      title: reco.title,
      detail: reco.detail,
      evidence: reco.evidence,
      patch: reco.patch,
      impact: reco.impact,
      confidence: reco.confidence,
      severity: reco.severity,
      updated_at: new Date().toISOString(),
    };
    if (!status) {
      const { error } = await admin.from("landing_recommendations").insert(row);
      if (!error) created += 1;
    } else if (status === "open") {
      const { error } = await admin.from("landing_recommendations").update(row).eq("key", reco.key);
      if (!error) updated += 1;
    }
  }

  // Les recommandations ouvertes qui ne sont plus justifiées disparaissent :
  // le tableau de bord ne doit montrer que des constats encore vrais.
  const live = new Set(generated.map((r) => r.key));
  const stale = (existing ?? [])
    .filter((r) => r.status === "open" && !live.has(r.key as string))
    .map((r) => r.key as string);
  if (stale.length > 0) {
    await admin.from("landing_recommendations").delete().in("key", stale);
  }

  return {
    created,
    updated,
    total: generated.length,
    objective: pickObjective(input.variants),
    sessions: input.kpis.sessions,
  };
}

/** Somme des succès d'un objectif — utilisé par le pilote automatique. */
export function objectiveTotal(stats: VariantStat[], objective: Objective): number {
  return stats.reduce((sum, s) => sum + successesOf(s, objective), 0);
}
