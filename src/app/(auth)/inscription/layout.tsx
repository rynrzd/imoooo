import type { Metadata } from "next";

/** Métadonnées SEO — la page est un composant client, elles vivent ici. */
export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Créez votre compte Nireo gratuitement : un logement offert, sans carte bancaire. Centralisez loyers, locataires et documents en quelques minutes.",
  alternates: { canonical: "/inscription" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
