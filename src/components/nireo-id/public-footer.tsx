import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { NID_SUBLINE } from "@/features/nireo-id/constants";
import { NidLogo } from "./nid-logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Nireo ID",
    links: [
      { label: "Comment ça marche", href: "/id#fonctionnement" },
      { label: "Entreprises", href: "/id#entreprises" },
      { label: "Réparateurs", href: "/id#reparateurs" },
      { label: "Tarifs", href: "/id#tarifs" },
      { label: "Questions fréquentes", href: "/id#faq" },
    ],
  },
  {
    title: "Votre espace",
    links: [
      { label: "Ajouter mon téléphone", href: "/id/app/objets/nouveau" },
      { label: "Se connecter", href: "/connexion?next=%2Fid%2Fapp" },
      { label: "Espace atelier", href: "/id/pro" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "Conditions", href: "/cgu" },
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export function NidPublicFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <NidLogo />
          <p className="max-w-xs text-sm text-muted-foreground">{NID_SUBLINE}</p>
          <p className="text-sm text-muted-foreground">
            Contact :{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-foreground underline underline-offset-2"
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
                <li key={`${column.title}-${link.href}`}>
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

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Nireo. Nireo ID est un produit de la marque Nireo —{" "}
            <Link href="/" className="underline underline-offset-2">
              Nireo Immo, gestion locative
            </Link>
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Nireo ne certifie pas l’authenticité d’un téléphone et n’interroge aucun fichier officiel.
          </p>
        </div>
      </div>
    </footer>
  );
}
