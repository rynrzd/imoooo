import type { Metadata } from "next";

/**
 * Étape de bienvenue : elle n'existe que pour un compte fraîchement créé.
 * Jamais indexée, jamais partagée — mais ses liens restent suivis.
 */
export const metadata: Metadata = {
  title: "Bienvenue",
  description: "Première étape de configuration de votre espace Nireo.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
