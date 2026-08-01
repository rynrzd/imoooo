import { getVariant, isValidSectionOrder, LANDING_SLOTS } from "./catalog";
import { coerceConfig } from "./config";
import {
  isSegmentKey,
  isSlotKey,
  SEGMENT_LABELS,
  type DeviceKey,
  type LandingConfig,
  type SectionKey,
  type SegmentKey,
  type SlotKey,
} from "./types";

/**
 * Landing Intelligence — MODIFICATIONS APPLICABLES EN UN CLIC.
 *
 * Une recommandation ne « modifie » jamais la page : elle propose un PATCH,
 * c'est-à-dire une transformation limitée et validée de la configuration.
 * Les patchs ne peuvent que :
 *   - déplacer du trafic entre variantes existantes ;
 *   - épingler / désépingler une variante du catalogue ;
 *   - ajouter une règle de personnalisation ;
 *   - proposer un nouvel ORDRE de sections (permutation validée).
 *
 * Aucun patch ne peut créer du texte, supprimer une section ou toucher au
 * SEO : la cohérence de la marque est structurellement garantie.
 */

export type LandingPatch =
  | { type: "weights"; weights: Record<string, Record<string, number>> }
  | { type: "boost"; slot: SlotKey; variant: string; share?: number }
  | {
      type: "rule";
      segment: SegmentKey | "any";
      device?: DeviceKey | null;
      slot: SlotKey;
      variant: string;
    }
  | { type: "order"; key: string; order: SectionKey[]; share?: number }
  | { type: "pin"; slot: SlotKey; variant: string }
  | { type: "unpin"; slot: SlotKey }
  | { type: "none" };

/** Part de trafic donnée par défaut à une variante mise en avant. */
const DEFAULT_BOOST_SHARE = 0.6;
const DEFAULT_ORDER_SHARE = 0.5;

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

function isDevice(value: unknown): value is DeviceKey {
  return value === "mobile" || value === "tablet" || value === "desktop";
}

/** Relit un patch stocké en base : toute forme inattendue est rejetée. */
export function coercePatch(raw: unknown): LandingPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.type) {
    case "none":
      return { type: "none" };
    case "weights": {
      if (!o.weights || typeof o.weights !== "object") return null;
      const weights: Record<string, Record<string, number>> = {};
      for (const [slot, value] of Object.entries(o.weights as Record<string, unknown>)) {
        if (!isSlotKey(slot) || !value || typeof value !== "object") continue;
        const entry: Record<string, number> = {};
        for (const [variant, w] of Object.entries(value as Record<string, unknown>)) {
          const num = Number(w);
          if (Number.isFinite(num) && num >= 0) entry[variant] = num;
        }
        if (Object.keys(entry).length > 0) weights[slot] = entry;
      }
      return Object.keys(weights).length > 0 ? { type: "weights", weights } : null;
    }
    case "boost":
    case "pin": {
      if (!isSlotKey(o.slot) || typeof o.variant !== "string") return null;
      return o.type === "pin"
        ? { type: "pin", slot: o.slot, variant: o.variant }
        : { type: "boost", slot: o.slot, variant: o.variant, share: Number(o.share) || undefined };
    }
    case "unpin":
      return isSlotKey(o.slot) ? { type: "unpin", slot: o.slot } : null;
    case "rule": {
      const segment = o.segment === "any" || isSegmentKey(o.segment) ? o.segment : null;
      if (!segment || !isSlotKey(o.slot) || typeof o.variant !== "string") return null;
      return {
        type: "rule",
        segment,
        device: isDevice(o.device) ? o.device : null,
        slot: o.slot,
        variant: o.variant,
      };
    }
    case "order": {
      if (typeof o.key !== "string" || !/^[a-z0-9_-]{1,40}$/.test(o.key)) return null;
      if (!isValidSectionOrder(o.order)) return null;
      return { type: "order", key: o.key, order: o.order, share: Number(o.share) || undefined };
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Application                                                       */
/* ------------------------------------------------------------------ */

/** Donne `share` du trafic à `winner`, le reste au prorata de l'existant. */
function boostWeights(
  current: Record<string, number> | undefined,
  candidates: string[],
  winner: string,
  share: number
): Record<string, number> {
  const others = candidates.filter((k) => k !== winner);
  const out: Record<string, number> = { [winner]: share };
  if (others.length === 0) return { [winner]: 1 };

  const previous = others.map((k) => Math.max(current?.[k] ?? 0, 0));
  const sum = previous.reduce((a, b) => a + b, 0);
  const rest = 1 - share;
  others.forEach((k, i) => {
    out[k] = sum > 0 ? (previous[i]! / sum) * rest : rest / others.length;
  });
  return out;
}

/**
 * Applique un patch et renvoie une configuration NEUVE (jamais mutée).
 * Le résultat repasse toujours par `coerceConfig` : une entrée corrompue ne
 * peut pas casser la vitrine.
 */
export function applyPatch(config: LandingConfig, patch: LandingPatch): LandingConfig {
  const next: LandingConfig = {
    ...config,
    weights: { ...config.weights },
    pins: { ...config.pins },
    rules: [...config.rules],
    disabled: [...config.disabled],
    customOrders: { ...config.customOrders },
  };

  switch (patch.type) {
    case "none":
      break;

    case "weights": {
      for (const [slot, weights] of Object.entries(patch.weights)) {
        if (!isSlotKey(slot)) continue;
        next.weights[slot] = { ...weights };
      }
      break;
    }

    case "boost": {
      const candidates = Object.keys(
        next.weights[patch.slot] ??
          Object.fromEntries(LANDING_SLOTS[patch.slot].variants.map((v) => [v.key, 1]))
      );
      if (!candidates.includes(patch.variant)) candidates.push(patch.variant);
      next.weights[patch.slot] = boostWeights(
        next.weights[patch.slot],
        candidates,
        patch.variant,
        Math.min(0.9, Math.max(0.2, patch.share ?? DEFAULT_BOOST_SHARE))
      );
      break;
    }

    case "pin": {
      if (getVariant(patch.slot, patch.variant) || patch.slot === "section_order") {
        next.pins[patch.slot] = patch.variant;
      }
      break;
    }

    case "unpin": {
      delete next.pins[patch.slot];
      break;
    }

    case "rule": {
      const device = patch.device ?? null;
      next.rules = next.rules.filter(
        (r) => !(r.segment === patch.segment && (r.device ?? null) === device && r.slot === patch.slot)
      );
      next.rules.push({
        segment: patch.segment,
        device,
        slot: patch.slot,
        variant: patch.variant,
        origin: "recommendation",
      });
      break;
    }

    case "order": {
      next.customOrders[patch.key] = [...patch.order];
      const candidates = new Set<string>([
        ...LANDING_SLOTS.section_order.variants.map((v) => v.key),
        ...Object.keys(next.customOrders),
      ]);
      next.weights.section_order = boostWeights(
        next.weights.section_order,
        [...candidates],
        patch.key,
        Math.min(0.9, Math.max(0.2, patch.share ?? DEFAULT_ORDER_SHARE))
      );
      break;
    }
  }

  next.updatedAt = new Date().toISOString();
  return coerceConfig(next);
}

/* ------------------------------------------------------------------ */
/*  Description lisible                                               */
/* ------------------------------------------------------------------ */

function variantLabel(slot: SlotKey, variant: string): string {
  return getVariant(slot, variant)?.label ?? variant;
}

/** Phrase française décrivant ce que « Appliquer » va faire. */
export function describePatch(patch: LandingPatch): string {
  switch (patch.type) {
    case "none":
      return "Aucune modification automatique — recommandation informative.";
    case "weights":
      return "Rééquilibrer la répartition du trafic selon les résultats mesurés.";
    case "boost":
      return `Envoyer davantage de trafic vers « ${variantLabel(patch.slot, patch.variant)} » (${LANDING_SLOTS[patch.slot].label}).`;
    case "pin":
      return `Figer « ${variantLabel(patch.slot, patch.variant)} » pour tous les visiteurs (${LANDING_SLOTS[patch.slot].label}).`;
    case "unpin":
      return `Relancer l'expérimentation sur « ${LANDING_SLOTS[patch.slot].label} ».`;
    case "rule": {
      const who =
        patch.segment === "any"
          ? patch.device
            ? `les visiteurs sur ${patch.device === "mobile" ? "mobile" : patch.device === "tablet" ? "tablette" : "ordinateur"}`
            : "tous les visiteurs"
          : `les visiteurs « ${SEGMENT_LABELS[patch.segment]} »${patch.device ? ` sur ${patch.device}` : ""}`;
      return `Servir « ${variantLabel(patch.slot, patch.variant)} » à ${who} (${LANDING_SLOTS[patch.slot].label}).`;
    }
    case "order":
      return "Tester un nouvel enchaînement de sections sur une partie du trafic.";
  }
}
