/** Constantes partagées de l'application. */

/** Visuel par défaut d'un logement sans photo. */
export const DEFAULT_PROPERTY_PHOTO =
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=75";

/**
 * Seuls les hôtes déclarés dans next.config.ts passent par l'optimiseur
 * d'images (redimensionnement + formats modernes). Les autres URL
 * (object URLs locales, hôtes inconnus) sont affichées telles quelles.
 */
export function needsUnoptimized(url: string): boolean {
  return !(
    url.startsWith("https://images.unsplash.com/") ||
    // URLs signées du Storage Supabase (remotePatterns : *.supabase.co).
    /^https:\/\/[a-z0-9-]+\.supabase\.co\//.test(url)
  );
}
