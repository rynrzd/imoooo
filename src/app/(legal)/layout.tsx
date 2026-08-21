import type { Viewport } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { RevealOnScroll } from "@/components/landing/reveal-on-scroll";
import { getPublicSiteSettings } from "@/lib/admin/settings";

/**
 * Segment des PAGES LÉGALES — CGU, confidentialité, mentions légales,
 * cookies.
 *
 * Elles restent des pages séparées (chacune garde son URL, ses métadonnées et
 * son `robots: { index: false }`), mais elles portent désormais l'identité
 * publique ACTUELLE : le scope `.nireo-landing`, le header de la landing et
 * son footer complet. Elles étaient jusqu'ici servies par le segment
 * `(public)`, c'est-à-dire l'univers obsidienne sombre — deux identités pour
 * un même visiteur, à un clic d'écart depuis le pied de page.
 *
 * Elles ne rejouent PAS l'écran d'introduction de la marque : il appartient à
 * l'arrivée sur la landing, pas à la lecture d'un document juridique.
 *
 * `.nireo-landing` ne redéfinit aucun token du design system : le gabarit
 * commun `LegalPage` (qui utilise `text-foreground`, `text-muted-foreground`,
 * `border-border`) s'affiche donc avec la palette claire, sur le papier blanc
 * cassé de la landing.
 */

/**
 * Aucune métadonnée ici : `metadataBase` et le gabarit de titre viennent du
 * segment racine, chaque page légale apporte le reste.
 *
 * Aucun `viewport-fit=cover` non plus — c'est la règle du header de la
 * landing, dont la hauteur est alors exactement celle qu'on lui donne.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070c15",
};

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const { announcement_message } = await getPublicSiteSettings();

  return (
    <div className="nireo-landing nl-tokens flex min-h-dvh flex-col overflow-x-clip">
      <LandingHeader announcement={announcement_message} />
      {/* Le header est fixe : le contenu commence sous lui — et sous le
          message d'annonce global quand il est posé. */}
      <main id="contenu" tabIndex={-1}
        className="flex-1"
        style={{
          paddingTop: announcement_message
            ? "calc(var(--nl-header-h) + 2.5rem)"
            : "var(--nl-header-h)",
        }}
      >
        {children}
      </main>
      {/* Révélations au défilement : un seul observateur pour tout le segment.
          Sans JavaScript et en mouvement réduit, il ne fait strictement rien. */}
      <RevealOnScroll />
      <LandingFooter complet />
    </div>
  );
}
