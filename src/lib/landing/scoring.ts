import { hash32 } from "./assign";

/**
 * Landing Intelligence — STATISTIQUES ET APPRENTISSAGE.
 *
 * Tout est calculé à partir des sessions réellement observées. Aucune valeur
 * aléatoire d'affichage, aucun score inventé : quand les données manquent, le
 * moteur le dit (`dataSufficient: false`) au lieu de produire un chiffre.
 *
 * Méthode :
 * - chaque variante est un essai de Bernoulli (la session a converti ou non) ;
 * - le taux est estimé par une loi Beta (a = succès + 1, b = échecs + 1) ;
 * - le SCORE /10 utilise un taux « rétréci » vers la moyenne du slot
 *   (Bayes empirique) : une variante vue 5 fois ne peut pas passer devant une
 *   variante vue 500 fois sur un coup de chance ;
 * - la répartition du trafic est un échantillonnage de Thompson : chaque
 *   variante reçoit la probabilité d'être réellement la meilleure, bornée par
 *   un plancher d'exploration (on n'arrête jamais complètement une variante).
 */

export interface VariantStat {
  slot: string;
  variant: string;
  sessions: number;
  engaged: number;
  ctaClicks: number;
  signups: number;
  payments: number;
  avgDwell: number;
  avgScroll: number;
}

/** Ce que le moteur cherche à maximiser. */
export type Objective = "payments" | "signups" | "ctaClicks" | "engaged";

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  payments: "paiements confirmés",
  signups: "comptes créés",
  ctaClicks: "clics sur un appel à l'action",
  engaged: "sessions engagées",
};

/** Volume minimal d'événements positifs avant d'optimiser sur cet objectif. */
const OBJECTIVE_MIN_EVENTS: Record<Objective, number> = {
  payments: 25,
  signups: 20,
  ctaClicks: 40,
  engaged: 0,
};

/** Sessions minimales par variante avant de publier un score. */
export const MIN_SESSIONS_FOR_SCORE = 30;

/** Poids du a priori dans le rétrécissement (Bayes empirique). */
const PRIOR_WEIGHT = 20;

export function successesOf(stat: VariantStat, objective: Objective): number {
  switch (objective) {
    case "payments":
      return stat.payments;
    case "signups":
      return stat.signups;
    case "ctaClicks":
      return stat.ctaClicks;
    case "engaged":
      return stat.engaged;
  }
}

/**
 * Objectif réellement mesurable aujourd'hui. On optimise la conversion la
 * plus profonde qui dispose d'assez de signal, et on retombe sinon sur un
 * indicateur avancé — sans jamais prétendre mesurer ce qu'on ne mesure pas.
 */
export function pickObjective(stats: VariantStat[]): Objective {
  const order: Objective[] = ["payments", "signups", "ctaClicks", "engaged"];
  for (const objective of order) {
    const total = stats.reduce((sum, s) => sum + successesOf(s, objective), 0);
    if (total >= OBJECTIVE_MIN_EVENTS[objective]) return objective;
  }
  return "engaged";
}

/* ------------------------------------------------------------------ */
/*  Loi Beta                                                           */
/* ------------------------------------------------------------------ */

/** Moyenne a posteriori (Laplace) — jamais 0 ni 1 sur petit échantillon. */
export function posteriorMean(successes: number, trials: number): number {
  return (successes + 1) / (trials + 2);
}

/** Écart-type a posteriori de la loi Beta. */
export function posteriorSd(successes: number, trials: number): number {
  const a = successes + 1;
  const b = trials - successes + 1;
  const n = a + b;
  return Math.sqrt((a * b) / (n * n * (n + 1)));
}

/** Intervalle de crédibilité à 95 % (approximation normale). */
export function credibleInterval(successes: number, trials: number): [number, number] {
  const mean = posteriorMean(successes, trials);
  const sd = posteriorSd(successes, trials);
  return [Math.max(0, mean - 1.96 * sd), Math.min(1, mean + 1.96 * sd)];
}

/** Fonction de répartition normale centrée réduite. */
function normalCdf(z: number): number {
  // Approximation d'Abramowitz & Stegun (erreur < 7.5e-8).
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/**
 * Probabilité que la variante A convertisse mieux que la variante B.
 * Approximation normale des deux lois Beta — suffisante et lisible.
 */
export function probabilityToBeat(
  a: { successes: number; trials: number },
  b: { successes: number; trials: number }
): number {
  const ma = posteriorMean(a.successes, a.trials);
  const mb = posteriorMean(b.successes, b.trials);
  const va = posteriorSd(a.successes, a.trials) ** 2;
  const vb = posteriorSd(b.successes, b.trials) ** 2;
  const sd = Math.sqrt(va + vb);
  if (sd <= 0) return ma > mb ? 1 : 0.5;
  return normalCdf((ma - mb) / sd);
}

/* ------------------------------------------------------------------ */
/*  Score /10                                                          */
/* ------------------------------------------------------------------ */

export interface VariantScore {
  slot: string;
  variant: string;
  sessions: number;
  successes: number;
  /** Taux observé brut (successes / sessions). */
  rate: number;
  /** Taux rétréci vers la moyenne du slot — la base du score. */
  adjustedRate: number;
  interval: [number, number];
  /** Note sur 10, relative à la meilleure variante du slot. */
  score: number;
  /** Probabilité d'être la meilleure variante du slot. */
  probabilityBest: number;
  /** false tant que l'échantillon est trop petit : le score est indicatif. */
  dataSufficient: boolean;
  avgDwell: number;
  avgScroll: number;
}

/**
 * Notes d'un slot. Le score est RELATIF : la meilleure variante du slot
 * obtient 10, les autres leur rapport à celle-ci. Un slot dont toutes les
 * variantes se valent affiche donc des notes proches — c'est voulu.
 */
export function scoreSlot(stats: VariantStat[], objective: Objective): VariantScore[] {
  if (stats.length === 0) return [];

  const totalTrials = stats.reduce((sum, s) => sum + s.sessions, 0);
  const totalSuccess = stats.reduce((sum, s) => sum + successesOf(s, objective), 0);
  const priorMean = totalTrials > 0 ? totalSuccess / totalTrials : 0;

  const rows = stats.map((stat) => {
    const successes = successesOf(stat, objective);
    const trials = stat.sessions;
    const adjustedRate =
      (successes + priorMean * PRIOR_WEIGHT) / Math.max(trials + PRIOR_WEIGHT, 1);
    return {
      stat,
      successes,
      trials,
      rate: trials > 0 ? successes / trials : 0,
      adjustedRate,
      interval: credibleInterval(successes, trials),
    };
  });

  // Référence du score : la meilleure variante DISPOSANT DE DONNÉES. Une
  // variante à peine servie ne peut donc pas définir l'échelle du slot.
  const trusted = rows.filter((r) => r.trials >= MIN_SESSIONS_FOR_SCORE);
  const best = Math.max(...(trusted.length > 0 ? trusted : rows).map((r) => r.adjustedRate), 1e-9);

  return rows.map((row) => {
    const others = rows.filter((r) => r !== row);
    const probabilityBest =
      others.length === 0
        ? 1
        : Math.min(
            ...others.map((other) =>
              probabilityToBeat(
                { successes: row.successes, trials: row.trials },
                { successes: other.successes, trials: other.trials }
              )
            )
          );
    return {
      slot: row.stat.slot,
      variant: row.stat.variant,
      sessions: row.trials,
      successes: row.successes,
      rate: row.rate,
      adjustedRate: row.adjustedRate,
      interval: row.interval,
      // Borné à 10 : une variante peu servie ne peut pas afficher un score
      // spectaculaire uniquement parce qu'elle a eu de la chance.
      score: Math.min(10, Math.round((row.adjustedRate / best) * 100) / 10),
      probabilityBest,
      dataSufficient: row.trials >= MIN_SESSIONS_FOR_SCORE,
      avgDwell: row.stat.avgDwell,
      avgScroll: row.stat.avgScroll,
    };
  });
}

/**
 * Classement d'affichage : les variantes disposant de données passent
 * TOUJOURS devant celles qui n'en ont pas encore assez. Une variante servie
 * 5 fois ne prend jamais la tête du tableau, quel que soit son taux observé.
 */
export function rankVariants(scores: VariantScore[]): VariantScore[] {
  return [...scores].sort((a, b) => {
    if (a.dataSufficient !== b.dataSufficient) return a.dataSufficient ? -1 : 1;
    return b.score - a.score;
  });
}

/* ------------------------------------------------------------------ */
/*  Échantillonnage de Thompson                                        */
/* ------------------------------------------------------------------ */

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Loi normale centrée réduite (Box-Muller). */
function randomNormal(random: () => number): number {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Loi Gamma(shape, 1) — méthode de Marsaglia & Tsang. */
function randomGamma(shape: number, random: () => number): number {
  if (shape < 1) {
    return randomGamma(shape + 1, random) * Math.pow(Math.max(random(), Number.EPSILON), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 200; i++) {
    const x = randomNormal(random);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = random();
    if (Math.log(Math.max(u, Number.EPSILON)) < 0.5 * x * x + d - d * v + d * Math.log(v)) {
      return d * v;
    }
  }
  return d; // repli : ne boucle jamais indéfiniment
}

/** Tirage dans une loi Beta(a, b). */
function randomBeta(a: number, b: number, random: () => number): number {
  const x = randomGamma(a, random);
  const y = randomGamma(b, random);
  return x + y > 0 ? x / (x + y) : 0.5;
}

/** Nombre de tirages Monte-Carlo (compromis précision / temps de calcul). */
const SAMPLES = 4000;

/**
 * Répartition de trafic apprise : probabilité, pour chaque variante, d'être
 * réellement la meilleure. Le plancher d'exploration est appliqué plus tard
 * par `normalizeWeights` — ici on renvoie les probabilités brutes.
 *
 * Déterministe : la graine dérive des données, donc deux recalculs sur les
 * mêmes chiffres donnent exactement le même résultat.
 */
export function thompsonWeights(stats: VariantStat[], objective: Objective): Record<string, number> {
  const out: Record<string, number> = {};
  if (stats.length === 0) return out;
  if (stats.length === 1) return { [stats[0]!.variant]: 1 };

  const seed = hash32(
    stats.map((s) => `${s.variant}:${s.sessions}:${successesOf(s, objective)}`).join("|")
  );
  const random = rng(seed);
  const params = stats.map((stat) => {
    const successes = successesOf(stat, objective);
    return { key: stat.variant, a: successes + 1, b: Math.max(stat.sessions - successes, 0) + 1 };
  });

  const wins = new Map<string, number>(params.map((p) => [p.key, 0]));
  for (let i = 0; i < SAMPLES; i++) {
    let bestKey = params[0]!.key;
    let bestValue = -1;
    for (const p of params) {
      const draw = randomBeta(p.a, p.b, random);
      if (draw > bestValue) {
        bestValue = draw;
        bestKey = p.key;
      }
    }
    wins.set(bestKey, (wins.get(bestKey) ?? 0) + 1);
  }
  for (const p of params) out[p.key] = (wins.get(p.key) ?? 0) / SAMPLES;
  return out;
}
