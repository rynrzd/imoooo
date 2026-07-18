import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/accueil", // doublon de « / » (réécriture) : une seule URL canonique
          "/logements",
          "/locataires",
          "/loyers",
          "/documents",
          "/photos",
          "/travaux",
          "/statistiques",
          "/parametres",
          "/abonnement",
          "/auth/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
