/**
 * Rate limit en mémoire (fenêtre glissante) — SERVEUR uniquement.
 *
 * Suffisant pour un déploiement mono-instance (Vercel serverless : la
 * limite s'applique par instance, c'est un garde-fou best-effort, pas une
 * garantie absolue — les vraies protections restent l'authentification,
 * la RLS et les vérifications métier des routes).
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/** Purge paresseuse pour éviter toute croissance non bornée. */
function prune(now: number, windowMs: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.every((t) => now - t > windowMs)) buckets.delete(key);
  }
}

/**
 * Retourne true si l'appel est autorisé (et le comptabilise),
 * false si la limite est atteinte pour la fenêtre donnée.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now, windowMs);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}
