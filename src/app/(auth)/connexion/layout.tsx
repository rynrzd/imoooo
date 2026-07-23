import type { Metadata } from "next";

/** Métadonnées SEO — la page est un composant client, elles vivent ici. */
export const metadata: Metadata = {
  title: "Connexion",
  description:
    "Connectez-vous à votre espace Nireo pour gérer vos logements, locataires, loyers et documents.",
  alternates: { canonical: "/connexion" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
