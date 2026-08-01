"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdminAction, type AdminContext } from "@/lib/admin/auth";
import type { ActionResult } from "@/lib/admin/types";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { LANDING_SLOTS } from "./catalog";
import {
  coerceTestimonials,
  DEFAULT_CONFIG,
  getCapabilitiesFresh,
  getLandingConfigFresh,
  invalidateEngineCache,
  TESTIMONIALS_KEY,
} from "./config";
import { commitConfig, recomputeWeights } from "./engine";
import { applyPatch, coercePatch, describePatch, type LandingPatch } from "./patch";
import { getVariantStats, rangeWindow } from "./queries";
import { generateRecommendations } from "./recommendations";
import { pickObjective, scoreSlot } from "./scoring";
import {
  isSegmentKey,
  isSlotKey,
  SLOT_KEYS,
  type DeviceKey,
  type LandingConfig,
  type SegmentRule,
  type Testimonial,
} from "./types";

/**
 * Landing Intelligence — ACTIONS D'ADMINISTRATION.
 *
 * Toute écriture passe par ici : contrôle du rôle administrateur,
 * validation du patch, VERSIONNAGE systématique (chaque changement crée une
 * version restaurable), journal d'audit, puis invalidation des caches.
 *
 * Rien ne s'applique tout seul, à une exception près et par choix explicite :
 * le pilote automatique, qui ne fait que déplacer du trafic entre variantes
 * déjà validées — il ne peut ni créer, ni supprimer, ni réécrire du contenu.
 */

/* ------------------------------------------------------------------ */
/*  Recommandations                                                   */
/* ------------------------------------------------------------------ */

/** Génère les recommandations à partir des données réelles. */
export async function runLandingAnalysis(): Promise<ActionResult> {
  try {
    await requireAdminAction(["admin"]);
    if (!isAdminConfigured) return { ok: false, error: "Base non configurée." };
    const [config, capabilities] = await Promise.all([getLandingConfigFresh(), getCapabilitiesFresh()]);
    const result = await generateRecommendations(config, capabilities);
    revalidatePath("/admin/landing");
    return {
      ok: true,
      message:
        result.total === 0
          ? `Analyse terminée : aucune recommandation à ce stade (${result.sessions} sessions analysées).`
          : `Analyse terminée : ${result.total} recommandation${result.total > 1 ? "s" : ""} (${result.created} nouvelle${result.created > 1 ? "s" : ""}).`,
    };
  } catch (e) {
    logger.error("landing/analyse", e);
    return { ok: false, error: e instanceof Error ? e.message : "Analyse impossible." };
  }
}

/** Applique une recommandation : crée une nouvelle version de la landing. */
export async function applyLandingRecommendation(id: string): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("landing_recommendations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "Recommandation introuvable." };
    if (data.status === "applied") return { ok: false, error: "Cette recommandation a déjà été appliquée." };

    const patch = coercePatch(data.patch);
    if (!patch) return { ok: false, error: "Cette recommandation ne contient aucune modification applicable." };
    if (patch.type === "none") {
      return { ok: false, error: "Recommandation informative : aucune modification automatique n'est possible." };
    }

    const current = await getLandingConfigFresh();
    const next = await commitConfig(
      applyPatch(current, patch),
      {
        label: (data.title as string).slice(0, 120),
        reason: describePatch(patch),
        origin: "recommendation",
        recommendationKey: data.key as string,
      },
      ctx
    );

    await admin
      .from("landing_recommendations")
      .update({
        status: "applied",
        applied_version: next.version,
        applied_at: new Date().toISOString(),
        applied_by: ctx.admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await logAdminAction(ctx, {
      action: "landing.apply_recommendation",
      targetLabel: data.key as string,
      newValue: { version: next.version, patch },
    });

    return { ok: true, message: `Appliqué. Version ${next.version} en ligne — retour arrière possible à tout moment.` };
  } catch (e) {
    logger.error("landing/apply", e);
    await logAdminAction(ctx, {
      action: "landing.apply_recommendation",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Application impossible." };
  }
}

/** Écarte une recommandation (elle ne sera pas régénérée). */
export async function dismissLandingRecommendation(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdminAction(["admin"]);
    const { error } = await createAdminClient()
      .from("landing_recommendations")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await logAdminAction(ctx, { action: "landing.dismiss_recommendation", targetLabel: id });
    revalidatePath("/admin/landing");
    return { ok: true, message: "Recommandation écartée." };
  } catch (e) {
    logger.error("landing/dismiss", e);
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/* ------------------------------------------------------------------ */
/*  Optimisation                                                      */
/* ------------------------------------------------------------------ */

/** Recalcule la répartition du trafic à partir des résultats mesurés. */
export async function rebalanceLandingWeights(): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const result = await recomputeWeights(ctx, "manual");
    if (!result) return { ok: false, error: "Pas encore assez de données pour rééquilibrer." };
    await logAdminAction(ctx, {
      action: "landing.rebalance",
      newValue: { version: result.version },
    });
    return { ok: true, message: `Répartition mise à jour — version ${result.version} en ligne.` };
  } catch (e) {
    logger.error("landing/rebalance", e);
    return { ok: false, error: e instanceof Error ? e.message : "Rééquilibrage impossible." };
  }
}

/**
 * Compose la meilleure combinaison connue : pour chaque slot disposant de
 * données suffisantes, la variante la mieux notée reçoit la majorité du
 * trafic. C'est la « nouvelle variante » assemblée par le moteur — elle reste
 * entièrement constituée d'éléments validés.
 */
export async function composeBestLanding(): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const config = await getLandingConfigFresh();
    const { since } = rangeWindow("30d");
    const stats = await getVariantStats(since.toISOString());
    const objective = pickObjective(stats);

    const weights: Record<string, Record<string, number>> = {};
    const chosen: string[] = [];
    for (const slot of SLOT_KEYS) {
      const slotStats = stats.filter((s) => s.slot === slot);
      if (slotStats.length < 2) continue;
      // On ne compose qu'avec des variantes réellement mesurées.
      const scores = scoreSlot(slotStats, objective)
        .filter((s) => s.dataSufficient)
        .sort((a, b) => b.adjustedRate - a.adjustedRate);
      if (scores.length === 0) continue;
      const best = scores[0]!;
      const others = scoreSlot(slotStats, objective).filter((s) => s.variant !== best.variant);
      const entry: Record<string, number> = { [best.variant]: 0.7 };
      others.forEach((o) => {
        entry[o.variant] = 0.3 / Math.max(others.length, 1);
      });
      weights[slot] = entry;
      chosen.push(`${LANDING_SLOTS[slot].label} → ${best.variant} (${best.score.toFixed(1)}/10)`);
    }

    if (chosen.length === 0) {
      return { ok: false, error: "Aucun slot ne dispose encore d'assez de données pour composer une combinaison." };
    }

    const next = await commitConfig(
      applyPatch(config, { type: "weights", weights }),
      {
        label: "Combinaison optimale",
        reason: `Meilleures variantes assemblées sur l'objectif « ${objective} ». ${chosen.join(" · ")}`,
        origin: "compose",
      },
      ctx
    );
    await logAdminAction(ctx, { action: "landing.compose", newValue: { version: next.version, chosen } });
    return { ok: true, message: `Combinaison appliquée — version ${next.version} en ligne.` };
  } catch (e) {
    logger.error("landing/compose", e);
    return { ok: false, error: e instanceof Error ? e.message : "Composition impossible." };
  }
}

/* ------------------------------------------------------------------ */
/*  Réglages, règles, retour arrière                                  */
/* ------------------------------------------------------------------ */

export async function updateLandingSettings(input: {
  autopilot?: boolean;
  explorationFloor?: number;
  ruleHoldout?: number;
}): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const config = await getLandingConfigFresh();
    const next: LandingConfig = {
      ...config,
      autopilot: typeof input.autopilot === "boolean" ? input.autopilot : config.autopilot,
      explorationFloor:
        typeof input.explorationFloor === "number" ? input.explorationFloor : config.explorationFloor,
      ruleHoldout: typeof input.ruleHoldout === "number" ? input.ruleHoldout : config.ruleHoldout,
    };
    const saved = await commitConfig(next, { label: "Réglages du moteur", reason: "Modification manuelle des réglages.", origin: "manual" }, ctx);
    await logAdminAction(ctx, { action: "landing.settings", newValue: input });
    return {
      ok: true,
      message: `Réglages enregistrés — version ${saved.version}${saved.autopilot ? " · pilote automatique actif" : ""}.`,
    };
  } catch (e) {
    logger.error("landing/settings", e);
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

/** Fige (ou libère) une variante pour tous les visiteurs. */
export async function pinLandingVariant(slot: string, variant: string | null): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    if (!isSlotKey(slot)) return { ok: false, error: "Emplacement inconnu." };
    const config = await getLandingConfigFresh();
    const patch: LandingPatch = variant
      ? { type: "pin", slot, variant }
      : { type: "unpin", slot };
    const saved = await commitConfig(
      applyPatch(config, patch),
      { label: variant ? "Variante figée" : "Expérimentation relancée", reason: describePatch(patch), origin: "manual" },
      ctx
    );
    await logAdminAction(ctx, { action: "landing.pin", targetLabel: slot, newValue: { variant } });
    return {
      ok: true,
      message: variant
        ? `Variante figée — version ${saved.version} en ligne.`
        : `Expérimentation relancée — version ${saved.version} en ligne.`,
    };
  } catch (e) {
    logger.error("landing/pin", e);
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Ajoute ou remplace une règle de personnalisation. */
export async function saveLandingRule(input: {
  segment: string;
  device: string | null;
  slot: string;
  variant: string;
}): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const segment = input.segment === "any" || isSegmentKey(input.segment) ? input.segment : null;
    if (!segment || !isSlotKey(input.slot)) return { ok: false, error: "Règle invalide." };
    const device =
      input.device === "mobile" || input.device === "tablet" || input.device === "desktop"
        ? (input.device as DeviceKey)
        : null;
    const patch: LandingPatch = { type: "rule", segment, device, slot: input.slot, variant: input.variant };
    const config = await getLandingConfigFresh();
    const saved = await commitConfig(
      applyPatch(config, patch),
      { label: "Règle de personnalisation", reason: describePatch(patch), origin: "manual" },
      ctx
    );
    await logAdminAction(ctx, { action: "landing.rule", newValue: input });
    return { ok: true, message: `Règle enregistrée — version ${saved.version} en ligne.` };
  } catch (e) {
    logger.error("landing/rule", e);
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Supprime une règle de personnalisation. */
export async function deleteLandingRule(input: {
  segment: string;
  device: string | null;
  slot: string;
}): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const config = await getLandingConfigFresh();
    const device = input.device ?? null;
    const rules: SegmentRule[] = config.rules.filter(
      (r) => !(r.segment === input.segment && (r.device ?? null) === device && r.slot === input.slot)
    );
    if (rules.length === config.rules.length) return { ok: false, error: "Règle introuvable." };
    const saved = await commitConfig(
      { ...config, rules },
      { label: "Règle supprimée", reason: `Règle ${input.segment}/${input.slot} retirée.`, origin: "manual" },
      ctx
    );
    await logAdminAction(ctx, { action: "landing.rule_delete", newValue: input });
    return { ok: true, message: `Règle supprimée — version ${saved.version} en ligne.` };
  } catch (e) {
    logger.error("landing/rule-delete", e);
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Retour arrière : réactive une version précédente, sans perdre l'historique. */
export async function rollbackLandingVersion(versionId: string): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const { data, error } = await createAdminClient()
      .from("landing_versions")
      .select("version, config, label")
      .eq("id", versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "Version introuvable." };

    const current = await getLandingConfigFresh();
    const restored = { ...(data.config as LandingConfig), version: current.version };
    const saved = await commitConfig(
      restored,
      {
        label: `Retour à la version ${data.version}`,
        reason: `Restauration de « ${(data.label as string) || `version ${data.version}`} ».`,
        origin: "rollback",
      },
      ctx
    );
    await logAdminAction(ctx, {
      action: "landing.rollback",
      newValue: { from: current.version, restored: data.version, newVersion: saved.version },
    });
    return { ok: true, message: `Version ${data.version} restaurée (publiée sous le numéro ${saved.version}).` };
  } catch (e) {
    logger.error("landing/rollback", e);
    return { ok: false, error: e instanceof Error ? e.message : "Retour arrière impossible." };
  }
}

/** Remet le moteur dans son état d'origine (contenu de référence). */
export async function resetLandingConfig(): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const current = await getLandingConfigFresh();
    const saved = await commitConfig(
      { ...DEFAULT_CONFIG, version: current.version, autopilot: current.autopilot },
      { label: "Réinitialisation", reason: "Retour à la configuration d'origine.", origin: "manual" },
      ctx
    );
    await logAdminAction(ctx, { action: "landing.reset", newValue: { version: saved.version } });
    return { ok: true, message: `Configuration réinitialisée — version ${saved.version} en ligne.` };
  } catch (e) {
    logger.error("landing/reset", e);
    return { ok: false, error: e instanceof Error ? e.message : "Réinitialisation impossible." };
  }
}

/* ------------------------------------------------------------------ */
/*  Contenu : témoignages réels                                       */
/* ------------------------------------------------------------------ */

/**
 * Enregistre les témoignages affichés sur la vitrine. Ils ne sont JAMAIS
 * générés : ce sont ceux saisis ici. Sans au moins deux témoignages, la
 * variante correspondante reste automatiquement hors expérimentation.
 */
export async function saveLandingTestimonials(input: Testimonial[]): Promise<ActionResult> {
  let ctx: AdminContext | null = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const clean = coerceTestimonials(input);
    const { error } = await createAdminClient()
      .from("site_settings")
      .upsert(
        {
          key: TESTIMONIALS_KEY,
          value: clean,
          updated_by: ctx.admin.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    if (error) throw new Error(error.message);

    invalidateEngineCache();
    revalidatePath("/");
    revalidatePath("/accueil");
    revalidatePath("/admin/landing");
    await logAdminAction(ctx, { action: "landing.testimonials", newValue: { count: clean.length } });
    return {
      ok: true,
      message:
        clean.length >= 2
          ? `${clean.length} témoignages enregistrés — la variante « Témoignages » entre dans l'expérimentation.`
          : `${clean.length} témoignage enregistré. Il en faut au moins 2 pour activer la variante.`,
    };
  } catch (e) {
    logger.error("landing/testimonials", e);
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}
