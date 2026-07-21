import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SITE_URL } from "@/lib/supabase/config";

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
  },
  twitter: {
    card: "summary",
    title: "Nireo — Gestion locative pour propriétaires bailleurs",
    description:
      "Centralisez logements, locataires, loyers, documents et travaux dans un seul espace.",
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

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col scroll-smooth">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
