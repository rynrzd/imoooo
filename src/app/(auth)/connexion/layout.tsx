import type { Metadata } from "next";

/** Métadonnées SEO — la page est un composant client, elles vivent ici. */
export const metadata: Metadata = {
  title: "Connexion",
  description:
    "Connectez-vous à votre espace Nireo pour gérer vos logements, locataires, loyers et documents.",
  alternates: { canonical: "/connexion" },
  // Formulaire sans contenu informatif : rien à positionner, et une page de
  // connexion indexée n'apporte aucune visite utile. Elle reste accessible et
  // les liens qu'elle porte restent suivis (`follow`).
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
