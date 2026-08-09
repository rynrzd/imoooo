import type { Metadata } from "next";

/** Métadonnées SEO — la page est un composant client, elles vivent ici. */
export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Créez votre compte Nireo gratuitement : un logement offert, sans carte bancaire. Centralisez loyers, locataires et documents en quelques minutes.",
  alternates: { canonical: "/inscription" },
  // Formulaire d'inscription : aucun contenu à positionner, et l'intention
  // « logiciel de gestion locative gratuit » est désormais traitée par un
  // guide qui, lui, répond vraiment à la question. La page reste accessible
  // et ses liens suivis — seuls les CTA y mènent, comme prévu.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
