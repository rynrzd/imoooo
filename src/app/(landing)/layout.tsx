import type { Metadata, Viewport } from "next";
import { BrandIntro } from "@/components/landing/brand-intro";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { getPublicSiteSettings } from "@/lib/admin/settings";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Segment de la LANDING PUBLIQUE.
 *
 * Elle a son propre gabarit parce qu'elle a son propre univers : cobalt, bleu
 * nuit presque noir, blanc cassé chaud (`.nireo-landing`, globals.css), et son
 * propre footer, compact. Le reste de la vitrine — tarifs, à propos, pages
 * légales, connexion — garde le thème obsidienne du segment `(public)` et son
 * footer complet ; l'application connectée n'est pas concernée du tout.
 *
 * Le scope `.nireo-landing` ne redéfinit AUCUN token du design system : c'est
 * ce qui permet à l'aperçu du produit de montrer l'application connectée avec
 * ses vraies couleurs.
 *
 * Les métadonnées reprennent celles du segment `(public)` : `metadataBase`,
 * carte Twitter, mots-clés et images sociales sont donc strictement
 * identiques à avant le changement de gabarit.
 */

/** Image sociale générée par app/opengraph-image.tsx (1200 × 630). */
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Nireo — Le logiciel de gestion locative des propriétaires bailleurs",
};

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
 * `viewport-fit=cover` : sur iPhone, la page occupe tout l'écran et les marges
 * de sécurité sont gérées explicitement (`env(safe-area-inset-*)`). Déclaré
 * sur ce segment uniquement.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Le haut de la page est la photographie du hero, sur fond bleu nuit : la
  // barre du navigateur se fond dedans plutôt que de trancher.
  themeColor: "#070c15",
};

export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  // Message d'annonce global géré depuis /admin/parametres (fonction SQL
  // publique — aucune clé secrète, jamais bloquant).
  const { announcement_message } = await getPublicSiteSettings();

  return (
    // Aucun décalage haut : le hero commence au pixel 0 et le header, fixe et
    // transparent, se pose PAR-DESSUS la photographie (cf. landing-header).
    // Le message d'annonce global fait partie de cette même pile fixe.
    //
    // `overflow-x-clip` : dernier rempart contre tout débordement horizontal,
    // les grands « N » débordant volontairement de leur section.
    <div className="nireo-landing flex min-h-dvh flex-col overflow-x-clip pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      {/* Écran d'introduction — inerte tant qu'un script ne l'active pas. */}
      <BrandIntro />

      <LandingHeader announcement={announcement_message} />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
