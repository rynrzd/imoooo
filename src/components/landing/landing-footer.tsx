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

const LINKS = [
  { label: "Produit", href: "/#produit" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "FAQ", href: "/tarifs#faq" },
  { label: "Contact", href: "/contact" },
];

const LEGAL = [
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "CGU", href: "/cgu" },
  { label: "Mentions légales", href: "/mentions-legales" },
];

export function LandingFooter() {
  return (
    <footer className="bg-[var(--nl-night)] text-white">
      <div className="mx-auto flex w-full max-w-[82rem] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-10">
        <NireoLogo
          flat
          onDark
          markClassName="bg-white text-[var(--nl-cobalt)] rounded-[0.5rem]"
        />

        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label="Liens du site">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9rem] md:justify-end">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/80 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Mentions légales">
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

          <p className="text-[0.82rem] text-white/45">
            © {new Date().getFullYear()} Nireo
          </p>
        </div>
      </div>
    </footer>
  );
}
