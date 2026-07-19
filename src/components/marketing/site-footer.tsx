import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { version } from "../../../package.json";

/** Adresse de contact — à ajuster quand le domaine définitif sera choisi. */
export const CONTACT_EMAIL = "contact@immopilot.app";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#fonctionnalites" },
      { label: "Comment ça marche", href: "/#comment-ca-marche" },
      { label: "Tarifs", href: "/tarifs" },
      { label: "FAQ", href: "/#faq" },
      { label: "Contact", href: "/contact" },
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
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Brand />
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
            © {new Date().getFullYear()} Noviqo. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground">Version {version}</p>
        </div>
      </div>
    </footer>
  );
}
