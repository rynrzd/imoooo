import Link from "next/link";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { COLUMNS, CONTACT_EMAIL } from "@/components/marketing/site-footer";

/**
 * Footer de la vitrine — bleu nuit, en deux tailles.
 *
 * DEUX VARIANTES, UN SEUL LANGAGE VISUEL
 * --------------------------------------
 * - par défaut : compact, deux rangées de liens. C'est celui de la landing,
 *   dont la page se termine sur une section forte : un pied de page bavard y
 *   casserait la chute.
 * - `complet` : les colonnes de la vitrine (produit, ressources, autres
 *   produits, compte, légal). C'est celui des pages publiques et légales, où
 *   le pied de page est aussi un outil de navigation.
 *
 * POURQUOI `complet` EXISTE
 * -------------------------
 * Les pages publiques utilisaient `SiteFooter`, qui expose TOUS les guides et
 * outils depuis `seo-pages.ts`. Les basculer sur le footer compact aurait
 * supprimé ce maillage interne de quinze pages d'un coup — une perte de
 * référencement invisible à l'œil, et irrattrapable sans s'en apercevoir. La
 * variante complète reprend donc exactement les mêmes colonnes, importées
 * depuis leur source unique, dans le langage visuel de la landing.
 *
 * Toutes les destinations sont des routes qui existent déjà.
 */

/**
 * Les trois premières entrées sont des ANCRES de la landing : elles pointent
 * vers les sections qui portent réellement ce contenu.
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

/** Liens de bas de page (mentions + contact), communs aux deux variantes. */
function LegalRow({ delay }: { delay: string }) {
  return (
    <nav aria-label="Mentions légales" data-seq style={{ ["--nl-delay" as string]: delay }}>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.82rem] md:justify-end">
        {LEGAL.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={false}
              className="nl-focus inline-block py-1 text-white/55 transition-colors hover:text-white/90"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="nl-focus inline-block py-1 text-white/55 transition-colors hover:text-white/90"
          >
            {CONTACT_EMAIL}
          </a>
        </li>
      </ul>
    </nav>
  );
}

export function LandingFooter({ complet = false }: { complet?: boolean }) {
  return (
    <footer className="bg-[var(--nl-night)] text-white">
      {complet ? (
        // Colonnes de navigation — chaque colonne entre à son tour, sans que
        // le visiteur ait à attendre : l'ensemble tient en moins de 400 ms.
        <div
          data-reveal
          className="nl-seq mx-auto grid w-full max-w-[82rem] grid-cols-2 gap-x-6 gap-y-9 px-5 pt-12 pb-10 sm:px-8 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-8 lg:pt-16"
        >
          {COLUMNS.map((column, index) => (
            <div
              key={column.title}
              data-seq
              style={{ ["--nl-delay" as string]: `${index * 60}ms` }}
            >
              <p className="text-[0.72rem] font-medium tracking-[0.14em] text-white/45 uppercase">
                {column.title}
              </p>
              {/* `py-1` : ces liens mesuraient 22 px de haut, sous le minimum
                  de 24 px (WCAG 2.5.8) — la hauteur est reprise sur l'interligne
                  (`space-y-2` au lieu de `2.5`), la colonne ne s'allonge pas.

                  `prefetch={false}` : le pied de page compte une vingtaine de
                  liens que Next précharge TOUS dès qu'il entre dans l'écran —
                  mesuré à 61 requêtes sur /contact contre 20 ailleurs. On ne
                  précharge pas ce que presque personne ne clique ; le clic reste
                  une navigation instantanée. */}
              <ul className="mt-4 space-y-2 text-[0.9rem]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="nl-focus nl-underline inline-block py-1 text-white/75 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {/* La page ne doit pas s'arrêter net : le pied de page arrive lui
          aussi, très discrètement, quand il entre dans le champ. */}
      <div
        data-reveal
        className={`nl-seq mx-auto flex w-full max-w-[82rem] flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-10 ${
          complet ? "border-t border-white/10 py-8" : "py-10"
        }`}
      >
        <span data-seq className="inline-flex">
          <NireoLogo
            flat
            onDark
            markClassName="bg-white text-[var(--nl-cobalt)] rounded-[0.5rem]"
          />
        </span>

        <div className="flex flex-col gap-3 md:items-end">
          {/* En variante complète, ces liens vivent déjà dans la colonne
              « Produit » : les répéter n'aiderait personne. */}
          {complet ? null : (
            <nav aria-label="Liens du site" data-seq style={{ ["--nl-delay" as string]: "90ms" }}>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9rem] md:justify-end">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="nl-focus nl-underline inline-block py-1 text-white/80 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <LegalRow delay={complet ? "60ms" : "170ms"} />

          <p
            data-seq
            style={{ ["--nl-delay" as string]: complet ? "120ms" : "230ms" }}
            className="text-[0.82rem] text-white/45"
          >
            © {new Date().getFullYear()} Nireo
          </p>
        </div>
      </div>
    </footer>
  );
}
