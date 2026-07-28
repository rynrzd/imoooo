import type { Metadata } from "next";
import { getPublicSiteSettings } from "@/lib/admin/settings";
import { ScrollProgress } from "@/components/marketing/scroll-progress";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SITE_URL } from "@/lib/supabase/config";

/** Image sociale générée par app/opengraph-image.tsx (1200 × 630). */
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Nireo — Le logiciel de gestion locative des propriétaires bailleurs",
};

/** Métadonnées des pages publiques (landing, tarifs, pages légales). */
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

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Message d'annonce global géré depuis /admin/parametres (lecture via la
  // fonction SQL publique — aucune clé secrète, jamais bloquant).
  const { announcement_message } = await getPublicSiteSettings();

  return (
    // Univers Nireo : thème sombre premium FORCÉ sur toute la vitrine
    // (indépendant de la préférence système). « dark » active les variantes
    // dark:* des composants réutilisés ; « nireo » applique la palette
    // obsidienne + signature bleu-ardoise.
    <div className="dark nireo relative flex min-h-dvh flex-col overflow-x-clip scroll-smooth bg-background text-foreground">
      {/* Décor ambiant fixe : aurore + grille en perspective + grain fin. */}
      <div aria-hidden className="nireo-ambient">
        <div className="nireo-grid" />
        <div className="nireo-noise" />
      </div>

      <ScrollProgress />

      {announcement_message ? (
        <div className="relative z-10 border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-sm font-medium text-foreground backdrop-blur">
          {announcement_message}
        </div>
      ) : null}
      <SiteHeader />
      <main className="relative z-10 flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
