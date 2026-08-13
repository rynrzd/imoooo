/** Constantes partagées de l'application. */

/*
 * Il n'y a plus de « photo par défaut ».
 *
 * Une image d'immeuble haussmannien piochée sur Unsplash était posée sur tout
 * logement sans photo : l'utilisateur voyait un bien qui n'était pas le sien,
 * et une donnée fictive présentée comme réelle. Un logement sans photo affiche
 * désormais une surface neutre (cf. `components/properties/property-thumb`).
 */

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
