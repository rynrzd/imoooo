import type { Metadata } from "next";
import { getPublicSiteSettings } from "@/lib/admin/settings";
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
    <div className="flex min-h-dvh flex-col scroll-smooth">
      {announcement_message ? (
        <div className="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
          {announcement_message}
        </div>
      ) : null}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
