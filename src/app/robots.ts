import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Zones jamais indexables : routes API, espaces authentifiés (Nireo Immo et
 * Nireo ID), administration, espace partenaire, et « /accueil » qui est le
 * doublon technique de « / » (réécriture) — une seule URL canonique.
 *
 * Cette liste est répétée à l'identique pour CHAQUE robot ayant sa propre
 * règle : dans le protocole robots.txt, un agent qui trouve un groupe à son
 * nom ignore complètement le groupe « * ». Une règle spécifique qui ne
 * répéterait pas les interdictions ouvrirait donc les routes privées à ce
 * robot précis.
 */
const DISALLOWED = [
  "/api/",
  "/accueil",
  "/logements",
  "/locataires",
  "/loyers",
  "/documents",
  "/photos",
  "/travaux",
  "/statistiques",
  "/pilotage",
  "/parametres",
  "/profil",
  "/baux",
  "/depenses",
  "/abonnement",
  "/auth/",
  "/admin",
  "/partenaire",
  "/fondateur/",
  "/id/app",
  "/id/pro",
  "/id/admin",
];

/**
 * ChatGPT Search s'appuie sur OAI-SearchBot : c'est le robot officiellement
 * documenté pour l'apparition d'un site dans ses réponses (OAI-SearchBot
 * n'entraîne aucun modèle). Il reçoit ici une autorisation explicite des
 * pages publiques, assortie des MÊMES interdictions que les autres robots.
 *
 * Aucune ressource de rendu (CSS, JavaScript, images, /_next/static) n'est
 * bloquée : une page publique doit pouvoir être rendue entièrement.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: DISALLOWED },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
