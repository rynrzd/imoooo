import Link from "next/link";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { GUIDES, PILLAR_PAGE, RESOURCES_PAGE } from "@/config/seo-pages";
import { version } from "../../../package.json";

/** Adresse de contact publique (footer, pages légales, formulaire, bug). */
export const CONTACT_EMAIL = "nireo.contacte@gmail.com";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#fonctionnalites" },
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

export function SiteFooter() {
  return (
    <footer className="nireo-hairline relative border-t border-border bg-muted/40">
      {/* 6 colonnes au total (marque + 5 rubriques) : la grille se replie en
          2 puis 3 colonnes avant d'être serrée — jamais de texte écrasé. */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 md:grid-cols-3 lg:grid-cols-[1.3fr_repeat(5,minmax(0,1fr))]">
        <div className="space-y-3">
          <NireoLogo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Le logiciel de gestion locative qui centralise logements,
            locataires, loyers, documents et travaux pour les propriétaires
            bailleurs.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact :{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-foreground uppercase">
              {column.title}
            </p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Nireo. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground">Version {version}</p>
        </div>
      </div>
    </footer>
  );
}
