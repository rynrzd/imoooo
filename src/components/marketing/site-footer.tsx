import { GUIDES, PILLAR_PAGE, RESOURCES_PAGE, TOOLS } from "@/config/seo-pages";


/** Adresse de contact publique (footer, pages légales, formulaire, bug). */
export const CONTACT_EMAIL = "nireo.contacte@gmail.com";

/**
 * Maillage interne de la vitrine — SEULE définition de ces colonnes.
 *
 * Exporté parce que le footer de la landing le reprend dans sa variante
 * complète (cf. landing-footer.tsx). Le recopier là-bas aurait créé un second
 * endroit à mettre à jour, et donc à oublier : les guides et les outils
 * viennent de `seo-pages.ts`, exactement comme le sitemap.
 */
export const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produit",
    links: [
      // Le produit, la sécurité et la FAQ sont des SECTIONS de la landing :
      // « /#fonctionnalites » pointait sur une ancre disparue. La grille
      // tarifaire, elle, garde sa page.
      { label: "Le produit", href: "/#produit" },
      { label: "Sécurité", href: "/#securite" },
      { label: "Tarifs", href: "/tarifs" },
      { label: "FAQ", href: "/#faq" },
      { label: "À propos", href: "/a-propos" },
      { label: "L’entreprise", href: "/entreprise" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    // Espace de contenu : la liste vient de src/config/seo-pages.ts, comme le
    // sitemap — aucune URL n'est saisie deux fois.
    title: "Ressources",
    links: [
      { label: PILLAR_PAGE.shortTitle, href: PILLAR_PAGE.path },
      { label: RESOURCES_PAGE.shortTitle, href: RESOURCES_PAGE.path },
      ...GUIDES.map((guide) => ({ label: guide.shortTitle, href: guide.path })),
      ...TOOLS.map((tool) => ({ label: tool.shortTitle, href: tool.path })),
    ],
  },
  {
    title: "Autres produits",
    links: [
      // Nireo ID : second produit de la marque (passeport numérique des objets).
      { label: "Nireo ID", href: "/id" },
      { label: "Espace réparateurs", href: "/id/pro/candidature" },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Se connecter", href: "/connexion" },
      { label: "Créer un compte", href: "/inscription" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "CGU", href: "/cgu" },
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

/*
 * Le composant `SiteFooter` vivait ici. Il n'était plus RENDU nulle part :
 * depuis l'unification de la vitrine, les segments (landing), (public) et
 * (legal) affichent tous `LandingFooter`. Seules ses données servaient
 * encore — d'où ce fichier, qui ne garde plus qu'elles.
 *
 * Deux pieds de page dont un mort, c'était surtout un piège : une retouche
 * (cible tactile, préchargement) pouvait atterrir dans celui que personne
 * n'affiche, sans que rien ne le signale.
 */
