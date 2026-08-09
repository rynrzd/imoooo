/**
 * Pages de contenu publiques (page pilier + guides) — SOURCE UNIQUE.
 *
 * Consommée par : le sitemap, la page /ressources, le maillage interne
 * (« À lire aussi »), le fil d'Ariane et les métadonnées de chaque page.
 * Ajouter une page ici suffit à la faire apparaître partout ; il n'existe
 * aucune liste d'URL dupliquée ailleurs.
 */

export interface ContentPage {
  /** Chemin absolu, sans barre oblique finale. */
  path: string;
  /** Balise <title> (sans le suffixe « · Nireo » ajouté par le gabarit). */
  title: string;
  /** Titre court affiché dans le fil d'Ariane et les cartes. */
  shortTitle: string;
  /** Meta description — unique à chaque page. */
  description: string;
  /** Résumé affiché sur /ressources (différent de la meta description). */
  summary: string;
  /** Date ISO de dernière mise à jour du contenu (mise à jour à la main). */
  updatedAt: string;
}

/** Page pilier : la page de référence sur la requête principale. */
export const PILLAR_PAGE: ContentPage = {
  path: "/logiciel-gestion-locative",
  title: "Logiciel de gestion locative pour propriétaires bailleurs",
  shortTitle: "Logiciel de gestion locative",
  description:
    "Nireo centralise logements, locataires, baux, loyers, documents, dépenses et travaux dans un seul espace. Gratuit pour un premier logement, sans carte bancaire.",
  summary:
    "La page de référence : ce qu'est un logiciel de gestion locative, ce que Nireo fait réellement, ses limites et ses offres.",
  updatedAt: "2026-08-09",
};

/** Page d'entrée de l'espace de contenu. */
export const RESOURCES_PAGE: ContentPage = {
  path: "/ressources",
  title: "Ressources sur la gestion locative",
  shortTitle: "Ressources",
  description:
    "Les guides Nireo pour organiser sa gestion locative : alternative à Excel, plan gratuit, propriétaire bailleur, SCI et suivi des loyers.",
  summary: "Le point de départ : tous les guides Nireo, classés par situation.",
  updatedAt: "2026-08-09",
};

export const GUIDES: readonly ContentPage[] = [
  {
    path: "/alternative-excel-gestion-locative",
    title: "Alternative à Excel pour gérer ses locations",
    shortTitle: "Alternative à Excel",
    description:
      "Excel suffit-il pour gérer ses locations ? Où le tableur atteint ses limites, ce qu'on perd en route, et comment Nireo centralise logements, loyers et documents.",
    summary:
      "Quand un tableur suffit, à partir de quand il coûte plus de temps qu'il n'en fait gagner, et ce que change un outil dédié.",
    updatedAt: "2026-08-09",
  },
  {
    path: "/logiciel-gestion-locative-gratuit",
    title: "Logiciel de gestion locative gratuit : ce que permet le plan Gratuit de Nireo",
    shortTitle: "Logiciel gratuit",
    description:
      "Ce que le plan Gratuit de Nireo permet réellement, ses limites exactes de logements, documents et stockage, et à qui il convient. Sans carte bancaire.",
    summary:
      "Les limites exactes du plan Gratuit, sans zone d'ombre : ce qu'il couvre, ce qu'il ne couvre pas, à qui il suffit.",
    updatedAt: "2026-08-09",
  },
  {
    path: "/gestion-locative-proprietaire-bailleur",
    title: "Gestion locative pour propriétaire bailleur : s'organiser en autogestion",
    shortTitle: "Propriétaire bailleur",
    description:
      "Comment un propriétaire bailleur qui gère lui-même ses locations s'organise : suivi des loyers, documents à conserver, dépenses, travaux — et ce que Nireo apporte.",
    summary:
      "La routine d'un bailleur en autogestion, mois par mois, et les fonctions de Nireo qui la soutiennent.",
    updatedAt: "2026-08-09",
  },
  {
    path: "/gestion-locative-sci",
    title: "Gestion locative pour SCI : centraliser les biens et les documents",
    shortTitle: "Gestion locative SCI",
    description:
      "Centraliser les biens, locataires, baux, loyers, dépenses et justificatifs d'une SCI dans un seul espace. Ce que Nireo fait — et ce qu'il ne fait pas.",
    summary:
      "Centraliser le patrimoine d'une SCI, avec une limite claire : Nireo ne fait ni comptabilité légale ni déclaration.",
    updatedAt: "2026-08-09",
  },
  {
    path: "/suivi-loyers",
    title: "Suivi des loyers : échéances, statuts et historique",
    shortTitle: "Suivi des loyers",
    description:
      "Organiser le suivi des loyers : échéances générées chaque mois, statuts payé, en attente, en retard ou partiel, encaissements et historique par logement.",
    summary:
      "Comment Nireo génère les échéances, suit les statuts et conserve l'historique des encaissements.",
    updatedAt: "2026-08-09",
  },
] as const;

/** Toutes les pages de contenu, dans l'ordre de priorité. */
export const CONTENT_PAGES: readonly ContentPage[] = [
  PILLAR_PAGE,
  RESOURCES_PAGE,
  ...GUIDES,
] as const;

/** Guide par chemin (maillage interne « À lire aussi »). */
export function getGuide(path: string): ContentPage {
  const guide = GUIDES.find((g) => g.path === path);
  if (!guide) throw new Error(`Guide inconnu : ${path}`);
  return guide;
}

/** Les autres guides que celui indiqué — pour les liens contextuels. */
export function otherGuides(path: string): ContentPage[] {
  return GUIDES.filter((g) => g.path !== path);
}

/** Date de mise à jour lisible en français (« 9 août 2026 »). */
export function formatUpdatedAt(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
