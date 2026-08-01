/**
 * Landing Intelligence — ASSIGNATION DÉTERMINISTE.
 *
 * Un visiteur doit voir la MÊME version d'une page à l'autre (sinon les
 * mesures n'ont aucun sens et l'expérience est incohérente). Plutôt que de
 * stocker l'assignation en base — un aller-retour réseau à chaque visite —
 * elle est RECALCULÉE à partir de l'identifiant du visiteur : même identifiant
 * + même configuration ⇒ même variante, en quelques microsecondes, sans I/O.
 *
 * Le rendu est donc entièrement fait côté serveur : aucun scintillement,
 * aucun rechargement, aucun script bloquant côté navigateur.
 */

/** FNV-1a 32 bits — rapide, stable, sans dépendance. */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Nombre stable dans [0, 1) dérivé d'une chaîne. */
export function unitFromHash(input: string): number {
  return hash32(input) / 0x100000000;
}

export interface WeightedCandidate {
  key: string;
  weight: number;
}

/**
 * Répartit le trafic entre variantes.
 *
 * `floor` garantit une part minimale à CHAQUE variante active : le moteur
 * augmente progressivement le trafic des meilleures sans jamais arrêter
 * complètement les autres — il continue d'apprendre en permanence.
 */
export function normalizeWeights(
  keys: string[],
  raw: Record<string, number> | undefined,
  floor: number
): Record<string, number> {
  const out: Record<string, number> = {};
  if (keys.length === 0) return out;
  if (keys.length === 1) return { [keys[0]!]: 1 };

  // Poids bruts : ceux enregistrés, sinon répartition uniforme.
  const values = keys.map((k) => {
    const v = raw?.[k];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  });
  const sum = values.reduce((a, b) => a + b, 0);
  const base = sum > 0 ? values.map((v) => v / sum) : keys.map(() => 1 / keys.length);

  // Plancher d'exploration : on réserve `floor` à chacun, le reste est
  // distribué proportionnellement aux poids appris.
  const safeFloor = Math.min(Math.max(floor, 0), 1 / keys.length);
  const reserved = safeFloor * keys.length;
  const scale = 1 - reserved;
  let total = 0;
  keys.forEach((k, i) => {
    const w = safeFloor + base[i]! * scale;
    out[k] = w;
    total += w;
  });
  // Renormalisation défensive (erreurs d'arrondi).
  if (total > 0 && Math.abs(total - 1) > 1e-9) {
    for (const k of keys) out[k] = out[k]! / total;
  }
  return out;
}

/** Tirage pondéré déterministe : `u` ∈ [0,1) issu du hash du visiteur. */
export function weightedPick(weights: Record<string, number>, u: number): string {
  const keys = Object.keys(weights);
  if (keys.length === 0) return "";
  let cumulative = 0;
  for (const key of keys) {
    cumulative += weights[key] ?? 0;
    if (u < cumulative) return key;
  }
  return keys[keys.length - 1]!;
}

/**
 * Assignation d'un slot pour un visiteur donné.
 * Le sel intègre la version de configuration : quand l'administration change
 * la répartition, les visiteurs sont rebattus proprement (et l'ancienne
 * mesure reste rattachée à l'ancienne version).
 */
export function assignVariant(
  visitorId: string,
  slot: string,
  configVersion: number,
  weights: Record<string, number>
): string {
  return weightedPick(weights, unitFromHash(`${visitorId}:${slot}:v${configVersion}`));
}

/**
 * true si ce visiteur fait partie du groupe témoin qui ignore volontairement
 * les règles de personnalisation. Sans ce témoin, il serait impossible de
 * savoir si la personnalisation apporte réellement quelque chose.
 */
export function isRuleHoldout(visitorId: string, holdout: number): boolean {
  if (holdout <= 0) return false;
  return unitFromHash(`${visitorId}:rule-holdout`) < holdout;
}
