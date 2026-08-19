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

/* ------------------------------------------------------------------ */
/* Compteur PARTAGÉ entre instances                                    */
/* ------------------------------------------------------------------ */

/**
 * Même contrat que `checkRateLimit`, mais le compteur vit en base : toutes
 * les instances serverless voient le même. Réservé aux surfaces où l'on
 * devine un identifiant (connexion administrateur, accès partenaire) — pour
 * le reste, un compteur par instance suffit largement.
 *
 * Dégradation assumée : si la fonction SQL n'est pas encore déployée
 * (migration 20260819090000 non appliquée), on retombe sur le compteur
 * mémoire. La protection ne disparaît donc jamais, elle est simplement
 * moins forte — et l'avertissement n'est écrit qu'une fois, pour ne pas
 * inonder les journaux à chaque tentative de connexion.
 */
let sharedUnavailableLogged = false;

export async function checkRateLimitShared(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const { isAdminConfigured, createAdminClient } = await import("@/lib/supabase/admin");
  if (!isAdminConfigured) return checkRateLimit(key, limit, windowMs);

  try {
    const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) throw new Error(error.message);
    return data === true;
  } catch (e) {
    if (!sharedUnavailableLogged) {
      sharedUnavailableLogged = true;
      const { logger } = await import("@/lib/logger");
      logger.error(
        "rate-limit",
        `compteur partagé indisponible, repli sur la mémoire : ${
          e instanceof Error ? e.message : "erreur inconnue"
        }`
      );
    }
    return checkRateLimit(key, limit, windowMs);
  }
}

/**
 * Le compteur partagé est-il réellement disponible ?
 *
 * Sonde SANS effet de bord : une clé vide fait retourner `false` à la
 * fonction SQL avant toute écriture. Si l'appel aboutit, la fonction
 * existe ; s'il échoue, la migration n'est pas appliquée. Aucune ligne
 * n'est insérée, aucun quota n'est consommé.
 */
export async function isSharedRateLimitAvailable(): Promise<boolean> {
  try {
    const { isAdminConfigured, createAdminClient } = await import("@/lib/supabase/admin");
    if (!isAdminConfigured) return false;
    const { error } = await createAdminClient().rpc("consume_rate_limit", {
      p_key: "",
      p_limit: 1,
      p_window_seconds: 1,
    });
    return !error;
  } catch {
    return false;
  }
}
