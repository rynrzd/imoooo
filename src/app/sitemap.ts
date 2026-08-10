import type { MetadataRoute } from "next";
import { CONTENT_PAGES, QUITTANCE_TOOL } from "@/config/seo-pages";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Sitemap des pages publiques INDEXABLES uniquement.
 *
 * Exclusions volontaires :
 * - toutes les routes privées (application, administration, partenaire) ;
 * - les pages légales (cgu, confidentialité, cookies, mentions légales),
 *   volontairement en noindex — les lister ferait remonter une contradiction
 *   dans Google Search Console ;
 * - « /connexion » et « /inscription » : ce sont des formulaires, sans contenu
 *   informatif à positionner. Elles restent parfaitement accessibles et
 *   suivies en lien, simplement pas soumises à l'indexation.
 *
 * Les pages de contenu proviennent de src/config/seo-pages.ts — la même
 * source que le maillage interne et les routes publiques du proxy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const contentEntries: MetadataRoute.Sitemap = CONTENT_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    // Date réelle de dernière révision du contenu (jamais « aujourd'hui »).
    lastModified: new Date(`${page.updatedAt}T00:00:00Z`),
    changeFrequency: "monthly",
    priority:
      page.path === "/logiciel-gestion-locative"
        ? 0.9
        : // Outil autonome, à forte intention : au-dessus des guides.
          page.path === QUITTANCE_TOOL.path
          ? 0.8
          : 0.7,
  }));

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...contentEntries,
    { url: `${SITE_URL}/tarifs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/fondateur`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    // Nireo ID — vitrine du second produit et sa démonstration publique.
    { url: `${SITE_URL}/id`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/id/exemple`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
