import { revalidatePath } from "next/cache";
import type { AdminContext } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { eligibleVariants, LANDING_SLOTS } from "./catalog";
import { getCapabilitiesFresh, getLandingConfigFresh, invalidateEngineCache } from "./config";
import { applyPatch, type LandingPatch } from "./patch";
import { getVariantStats, rangeWindow } from "./queries";
import { pickObjective, thompsonWeights } from "./scoring";
import { isSlotKey, SLOT_KEYS, type LandingConfig } from "./types";

/**
 * Landing Intelligence — OPÉRATIONS INTERNES DU MOTEUR.
 *
 * Ce module N'EST PAS un fichier « use server » : ses fonctions ne sont donc
 * jamais exposées comme points d'entrée publics. Elles sont appelées soit par
 * les Server Actions (après contrôle du rôle administrateur), soit par la
 * tâche planifiée (après vérification du secret de cron).
 */

export interface CommitMeta {
  label: string;
  reason: string;
  origin: "manual" | "recommendation" | "autopilot" | "rollback" | "compose";
  recommendationKey?: string | null;
}

/**
 * Publie une nouvelle version de la configuration.
 * Chaque changement est historisé : le retour arrière est toujours possible.
 */
export async function commitConfig(
  config: LandingConfig,
  meta: CommitMeta,
  ctx: AdminContext | null
): Promise<LandingConfig> {
  const admin = createAdminClient();
  const version = config.version + 1;
  const next: LandingConfig = { ...config, version, updatedAt: new Date().toISOString() };

  const { error } = await admin.from("landing_config").upsert(
    {
      id: true,
      version,
      config: next,
      updated_by: ctx?.admin.id ?? null,
      updated_at: next.updatedAt,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Enregistrement de la configuration impossible : ${error.message}`);

  const { error: historyError } = await admin.from("landing_versions").insert({
    version,
    config: next,
    label: meta.label.slice(0, 120),
    reason: meta.reason.slice(0, 600),
    origin: meta.origin,
    recommendation_key: meta.recommendationKey ?? null,
    created_by: ctx?.admin.id ?? null,
  });
  if (historyError) logger.error("landing/versions", historyError);

  // Le cache mémoire de CE processus est vidé immédiatement ; les autres
  // instances rechargent au plus tard au bout d'une minute.
  invalidateEngineCache();
  revalidatePath("/");
  revalidatePath("/accueil");
  revalidatePath("/admin/landing");
  return next;
}

/**
 * Pilote automatique : échantillonnage de Thompson sur chaque emplacement.
 *
 * Le moteur ne fait QUE déplacer du trafic entre des variantes déjà validées.
 * Il ne crée aucun contenu, n'en supprime aucun, et le plancher d'exploration
 * garantit qu'aucune variante n'est jamais complètement arrêtée.
 *
 * Retourne `null` si les données sont insuffisantes ou si la répartition
 * n'a pas bougé de façon significative (aucune version inutile n'est créée).
 */
export async function recomputeWeights(
  ctx: AdminContext | null,
  origin: "manual" | "autopilot"
): Promise<LandingConfig | null> {
  if (!isAdminConfigured) return null;
  const [config, capabilities] = await Promise.all([getLandingConfigFresh(), getCapabilitiesFresh()]);
  const { since } = rangeWindow("30d");
  const stats = await getVariantStats(since.toISOString());
  if (stats.length === 0) return null;

  const objective = pickObjective(stats);
  const weights: Record<string, Record<string, number>> = {};
  let changed = false;

  for (const slot of SLOT_KEYS) {
    // Un emplacement épinglé n'est plus en expérimentation.
    if (config.pins[slot]) continue;

    const servable = new Set(eligibleVariants(slot, capabilities, config.disabled).map((v) => v.key));
    if (slot === "section_order") {
      for (const key of Object.keys(config.customOrders)) servable.add(key);
    }
    const usable = stats.filter((s) => s.slot === slot && servable.has(s.variant));
    if (usable.length < 2) continue;
    // Trop peu d'observations : on ne touche à rien.
    if (usable.reduce((sum, s) => sum + s.sessions, 0) < 60) continue;

    const next = thompsonWeights(usable, objective);
    const previous = config.weights[slot] ?? {};
    const previousTotal = Object.values(previous).reduce((a, b) => a + b, 0) || 1;
    const drift = Object.keys(next).some(
      (k) => Math.abs((previous[k] ?? 0) / previousTotal - (next[k] ?? 0)) > 0.03
    );
    if (drift) {
      weights[slot] = next;
      changed = true;
    }
  }

  if (!changed) return null;

  const patch: LandingPatch = { type: "weights", weights };
  const summary = Object.entries(weights)
    .map(([slot, w]) => {
      const best = Object.entries(w).sort((a, b) => b[1] - a[1])[0];
      const label = isSlotKey(slot) ? LANDING_SLOTS[slot].label : slot;
      return best ? `${label} → ${best[0]} (${Math.round(best[1] * 100)} %)` : label;
    })
    .join(" · ");

  return commitConfig(
    applyPatch(config, patch),
    {
      label: origin === "autopilot" ? "Pilote automatique" : "Rééquilibrage manuel",
      reason: `Répartition recalculée sur l'objectif « ${objective} ». ${summary}`,
      origin: origin === "autopilot" ? "autopilot" : "manual",
    },
    ctx
  );
}
