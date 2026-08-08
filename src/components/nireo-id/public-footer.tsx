import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { NidLogo } from "./nid-logo";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Produits Nireo",
    links: [
      { label: "Nireo Immo — gestion locative", href: "/" },
      { label: "Nireo ID — passeport des objets", href: "/id" },
      { label: "Espace professionnel", href: "/id/pro" },
    ],
  },
  {
    title: "Nireo ID",
    links: [
      { label: "Fonctionnement", href: "/id#fonctionnement" },
      { label: "Niveaux de confiance", href: "/id#confiance" },
      { label: "Voir un exemple", href: "/id/exemple" },
      { label: "FAQ", href: "/id#faq" },
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
          <p className="max-w-xs text-sm text-muted-foreground">
            Le passeport numérique des objets : documents, état, réparations et
            changements de propriétaire, réunis dans un dossier qui suit l’objet.
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
            © {new Date().getFullYear()} Nireo. Nireo ID et Nireo Immo sont deux produits de la marque Nireo.
          </p>
          <p className="text-xs text-muted-foreground">
            Nireo ne certifie pas l’authenticité d’un appareil ni son origine.
          </p>
        </div>
      </div>
    </footer>
  );
}
