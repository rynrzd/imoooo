import { assignVariant, isRuleHoldout, normalizeWeights } from "./assign";
import {
  baselineVariant,
  defaultSectionOrder,
  eligibleVariants,
  getVariant,
  isValidSectionOrder,
  payloadOf,
} from "./catalog";
import type { EngineState } from "./config";
import {
  ruleMatches,
  ruleSpecificity,
  SLOT_KEYS,
  type LandingCapabilities,
  type LandingConfig,
  type LandingContent,
  type LandingResolution,
  type SectionKey,
  type SlotKey,
  type VisitorProfile,
} from "./types";

/**
 * Landing Intelligence — RÉSOLUTION.
 *
 * Transforme (profil visiteur + configuration + catalogue) en contenu prêt à
 * rendre. Fonction PURE et synchrone : aucune I/O, aucun accès réseau — elle
 * s'exécute pendant le rendu serveur de la page, ce qui garantit
 * personnalisation invisible, zéro scintillement et Core Web Vitals intacts.
 *
 * Ordre de décision pour chaque slot :
 *   1. variante épinglée (l'administration a tranché) ;
 *   2. règle de personnalisation du segment — sauf pour le groupe témoin ;
 *   3. tirage pondéré déterministe (le moteur d'expérimentation).
 *
 * Les robots d'indexation ne sont jamais personnalisés : ils reçoivent la
 * variante de référence, donc un contenu canonique stable pour le SEO.
 */

/** Toutes les clés de variantes servables d'un slot, dans l'ordre du catalogue. */
export function candidateKeys(
  slot: SlotKey,
  config: LandingConfig,
  capabilities: LandingCapabilities
): string[] {
  const keys = eligibleVariants(slot, capabilities, config.disabled).map((v) => v.key);
  if (slot === "section_order") {
    for (const key of Object.keys(config.customOrders)) {
      if (!keys.includes(key) && !config.disabled.includes(`section_order:${key}`)) keys.push(key);
    }
  }
  return keys;
}

/** Répartition de trafic effective d'un slot (poids appris + plancher). */
export function slotWeights(
  slot: SlotKey,
  config: LandingConfig,
  capabilities: LandingCapabilities
): Record<string, number> {
  return normalizeWeights(
    candidateKeys(slot, config, capabilities),
    config.weights[slot],
    config.explorationFloor
  );
}

/** L'ordre de sections correspondant à une variante (catalogue ou composé). */
export function sectionOrderOf(variantKey: string, config: LandingConfig): SectionKey[] {
  const custom = config.customOrders[variantKey];
  if (custom && isValidSectionOrder(custom)) return [...custom];
  const variant = getVariant("section_order", variantKey);
  if (variant && isValidSectionOrder(variant.payload.order)) return [...variant.payload.order];
  return defaultSectionOrder();
}

interface SlotDecision {
  variant: string;
  /** true si la variante vient d'une règle de personnalisation. */
  fromRule: boolean;
}

function decideSlot(
  slot: SlotKey,
  profile: VisitorProfile,
  config: LandingConfig,
  capabilities: LandingCapabilities,
  holdout: boolean
): SlotDecision {
  const candidates = candidateKeys(slot, config, capabilities);
  const fallback = candidates[0] ?? baselineVariant(slot).key;

  // 1. Épinglage : l'administration a figé ce slot.
  const pin = config.pins[slot];
  if (pin && candidates.includes(pin)) return { variant: pin, fromRule: false };

  // Robot / identité absente : contenu canonique, jamais d'expérimentation.
  if (!profile.visitorId) return { variant: fallback, fromRule: false };

  // 2. Règle de personnalisation (hors groupe témoin). La règle la plus
  //    précise l'emporte : segment + appareil > segment > appareil seul.
  if (!holdout) {
    const rule = config.rules
      .filter((r) => r.slot === slot && ruleMatches(r, profile) && candidates.includes(r.variant))
      .sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))[0];
    if (rule) return { variant: rule.variant, fromRule: true };
  }

  // 3. Expérimentation : tirage pondéré, stable pour ce visiteur.
  const weights = normalizeWeights(candidates, config.weights[slot], config.explorationFloor);
  const picked = assignVariant(profile.visitorId, slot, config.version, weights);
  return { variant: candidates.includes(picked) ? picked : fallback, fromRule: false };
}

/** Résout la page complète pour un visiteur. Synchrone, sans I/O. */
export function resolveLanding(profile: VisitorProfile, state: EngineState): LandingResolution {
  const { config, capabilities } = state;
  const holdout = profile.visitorId ? isRuleHoldout(profile.visitorId, config.ruleHoldout) : true;

  const assignments: Record<string, string> = {};
  let personalized = false;
  for (const slot of SLOT_KEYS) {
    const decision = decideSlot(slot, profile, config, capabilities, holdout);
    assignments[slot] = decision.variant;
    if (decision.fromRule) personalized = true;
  }

  const content: LandingContent = {
    headline: payloadOf("hero_headline", assignments.hero_headline!),
    subheadline: payloadOf("hero_subheadline", assignments.hero_subheadline!),
    cta: payloadOf("hero_cta", assignments.hero_cta!),
    media: payloadOf("hero_media", assignments.hero_media!),
    proof: payloadOf("proof", assignments.proof!),
    pricingEmphasis: payloadOf("pricing_emphasis", assignments.pricing_emphasis!),
    finalCta: payloadOf("final_cta", assignments.final_cta!),
    sections: sectionOrderOf(assignments.section_order!, config),
  };

  return { content, assignments, profile, configVersion: config.version, personalized };
}

/**
 * Résolution « de référence » : ce que voient les robots et ce qui sert de
 * base de comparaison dans l'administration (aucune personnalisation).
 */
export function resolveBaseline(state: EngineState, profile: VisitorProfile): LandingResolution {
  return resolveLanding({ ...profile, visitorId: "" }, state);
}
