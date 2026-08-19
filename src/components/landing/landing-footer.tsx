import Link from "next/link";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";

/**
 * Footer de la landing — compact, bleu nuit, deux rangées de liens.
 *
 * Il ne remplace pas `SiteFooter` : celui-ci reste le footer des autres pages
 * publiques (tarifs, à propos, pages de contenu, ressources) avec ses colonnes
 * complètes. Ici la page est courte, le footer l'est aussi.
 *
 * Toutes les destinations sont des routes qui existent déjà.
 */

/**
 * Les trois premières entrées sont des ANCRES de la landing : elles pointent
 * vers les sections qui portent réellement ce contenu, plus vers des pages
 * restées à l'ancienne identité.
 */
const LINKS = [
  { label: "Le produit", href: "/#produit" },
  { label: "Sécurité", href: "/#securite" },
  { label: "FAQ", href: "/#faq" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Contact", href: "/contact" },
];

const LEGAL = [
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "CGU", href: "/cgu" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Cookies", href: "/cookies" },
];

export function LandingFooter() {
  return (
    <footer className="bg-[var(--nl-night)] text-white">
      {/* La page ne doit pas s'arrêter net : le pied de page arrive lui
          aussi, très discrètement, quand il entre dans le champ. */}
      <div
        data-reveal
        className="nl-seq mx-auto flex w-full max-w-[82rem] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-10"
      >
        <span data-seq className="inline-flex">
          <NireoLogo
            flat
            onDark
            markClassName="bg-white text-[var(--nl-cobalt)] rounded-[0.5rem]"
          />
        </span>

        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label="Liens du site" data-seq style={{ ["--nl-delay" as string]: "90ms" }}>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9rem] md:justify-end">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="nl-focus nl-underline text-white/80 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Mentions légales" data-seq style={{ ["--nl-delay" as string]: "170ms" }}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.82rem] md:justify-end">
              {LEGAL.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/55 transition-colors hover:text-white/90"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-white/55 transition-colors hover:text-white/90"
                >
                  {CONTACT_EMAIL}
                </a>
              </li>
            </ul>
          </nav>

          <p data-seq style={{ ["--nl-delay" as string]: "230ms" }} className="text-[0.82rem] text-white/45">
            © {new Date().getFullYear()} Nireo
          </p>
        </div>
      </div>
    </footer>
  );
}
