import type { Metadata, Viewport } from "next";
import { getPublicSiteSettings } from "@/lib/admin/settings";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { RevealOnScroll } from "@/components/landing/reveal-on-scroll";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Segment des PAGES PUBLIQUES — tarifs, ressources, outils, pages de contenu,
 * à propos, contact, entreprise, fondateur.
 *
 * CE QUI CHANGE, ET POURQUOI
 * --------------------------
 * Ce segment servait jusqu'ici l'univers obsidienne : `.dark .nireo`, thème
 * sombre forcé, décor ambiant (aurore, grille, grain), `SiteHeader` et
 * `SiteFooter`. La landing, elle, a adopté l'identité claire cobalt / bleu
 * nuit / blanc cassé — et les pages légales l'ont suivie. Un visiteur passait
 * donc d'un univers à l'autre à un seul clic, sans quitter le site.
 *
 * Il porte désormais la MÊME identité que la landing : le scope
 * `.nireo-landing`, son header et son footer. Rien du contenu, des URL ni des
 * métadonnées n'est touché — seul le gabarit change.
 *
 * Conséquence utile : tout le système d'animation de la landing
 * (`data-reveal`, `data-line`, `nl-seq`…) est défini SOUS le scope
 * `.nireo-landing`. Il était donc inerte ici ; il devient actif du seul fait
 * de ce changement, sans une ligne de JavaScript supplémentaire.
 *
 * Le footer est en variante `complet` : les colonnes de maillage interne
 * (guides et outils issus de `seo-pages.ts`) sont conservées à l'identique.
 * Les perdre aurait été une régression de référencement invisible à l'œil.
 *
 * L'écran d'introduction de la marque n'est PAS rejoué : il appartient à
 * l'arrivée sur la landing.
 */

/** Image sociale générée par app/opengraph-image.tsx (1200 × 630). */
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Nireo — Le logiciel de gestion locative des propriétaires bailleurs",
};

/** Métadonnées des pages publiques — inchangées. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nireo — Gestion locative simple pour propriétaires bailleurs",
    template: "%s · Nireo",
  },
  description:
    "Centralisez logements, locataires, loyers, documents, photos, dépenses et travaux dans un seul espace. Un logiciel de gestion locative simple, conçu pour les propriétaires bailleurs.",
  openGraph: {
    type: "website",
    siteName: "Nireo",
    locale: "fr_FR",
    title: "Nireo — Gérez tout votre patrimoine immobilier depuis une seule plateforme",
    description:
      "Logements, locataires, loyers automatiques, documents, photos, dépenses et travaux : un seul espace, conçu pour les propriétaires bailleurs.",
    // Ce bloc REMPLACE l'openGraph du segment racine (fusion superficielle) :
    // l'image générée par app/opengraph-image.tsx doit être re-déclarée ici.
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nireo — Gestion locative pour propriétaires bailleurs",
    description:
      "Centralisez logements, locataires, loyers, documents et travaux dans un seul espace.",
    images: [OG_IMAGE],
  },
  keywords: [
    "gestion locative",
    "logiciel gestion locative",
    "propriétaire bailleur",
    "suivi des loyers",
    "quittance de loyer",
    "patrimoine immobilier",
    "SCI",
    "alternative Excel gestion locative",
  ],
};

/**
 * PLUS de `viewport-fit=cover` : c'est la règle du header de la landing.
 *
 * Avec `cover`, le contenu passe sous l'encoche iPhone et le header doit
 * réserver `env(safe-area-inset-top)` — la barre atteignait alors ~115 px et
 * mangeait le haut de la page. Sans `cover`, tous les `env(safe-area-inset-*)`
 * valent 0 et la hauteur du header est exactement celle qu'on lui donne.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070c15",
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Message d'annonce global géré depuis /admin/parametres (lecture via la
  // fonction SQL publique — aucune clé secrète, jamais bloquant).
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
