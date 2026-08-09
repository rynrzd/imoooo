import { CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { planOffersJsonLd } from "@/config/plans";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Données structurées schema.org — SOURCE UNIQUE.
 *
 * Règles tenues ici :
 * - aucune note, aucun avis, aucun `aggregateRating` : Nireo n'a pas d'avis
 *   vérifiables publiés, en inventer serait faux (et sanctionné) ;
 * - aucun profil social (`sameAs`) tant qu'aucun compte n'est réellement
 *   ouvert et relié au site ;
 * - les offres proviennent de src/config/plans.ts : un tarif modifié met
 *   automatiquement le balisage à jour.
 */

/** Identifiants stables : les nœuds se référencent au lieu d'être dupliqués. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "Nireo",
  url: SITE_URL,
  email: CONTACT_EMAIL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo-nireo.svg`,
    width: 512,
    height: 512,
  },
  description:
    "Nireo édite un logiciel de gestion locative destiné aux propriétaires bailleurs qui gèrent eux-mêmes leurs biens.",
} as const;

export const webSiteJsonLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: "Nireo",
  url: SITE_URL,
  inLanguage: "fr-FR",
  publisher: { "@id": ORGANIZATION_ID },
} as const;

/**
 * L'application elle-même. `offers` est dérivé des plans réels ;
 * le plan Gratuit justifie `price: 0` sans mensonge sur la gratuité totale.
 */
export const softwareApplicationJsonLd = {
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  name: "Nireo",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Logiciel de gestion locative",
  operatingSystem: "Web (navigateur)",
  inLanguage: "fr-FR",
  url: SITE_URL,
  publisher: { "@id": ORGANIZATION_ID },
  description:
    "Logiciel de gestion locative pour propriétaires bailleurs : logements, locataires, baux, loyers, documents, photos, dépenses, travaux et statistiques dans un seul espace.",
  offers: planOffersJsonLd(SITE_URL),
} as const;

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * FAQPage — à n'émettre QUE si les questions et réponses sont réellement
 * visibles dans le HTML de la page (règle Google, et simple honnêteté).
 */
export function faqPageJsonLd(items: FaqEntry[], pageUrl: string) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export interface Crumb {
  name: string;
  /** Chemin absolu commençant par « / ». */
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path === "/" ? "" : crumb.path}`,
    })),
  };
}

/**
 * Page de contenu éditorial. Auteur = l'organisation Nireo : aucun auteur
 * individuel n'est inventé.
 */
export function articleJsonLd({
  headline,
  description,
  path,
  datePublished,
  dateModified,
}: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
}) {
  const url = `${SITE_URL}${path}`;
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    description,
    inLanguage: "fr-FR",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    datePublished,
    dateModified,
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

export function webPageJsonLd({
  name,
  description,
  path,
  dateModified,
}: {
  name: string;
  description: string;
  path: string;
  dateModified?: string;
}) {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  return {
    "@type": "WebPage",
    "@id": url,
    name,
    description,
    url,
    inLanguage: "fr-FR",
    isPartOf: { "@id": WEBSITE_ID },
    ...(dateModified ? { dateModified } : {}),
  };
}

/** Assemble un graphe schema.org complet. */
export function jsonLdGraph(nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
