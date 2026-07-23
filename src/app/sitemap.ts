import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Sitemap des pages publiques INDEXABLES uniquement : les routes privées sont
 * protégées et les pages légales (cgu, confidentialité, cookies, mentions
 * légales) sont volontairement en noindex — les lister ferait remonter une
 * contradiction dans Google Search Console.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/tarifs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/fondateur`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/inscription`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/connexion`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
}
