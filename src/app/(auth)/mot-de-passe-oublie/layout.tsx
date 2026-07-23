import type { Metadata } from "next";

/** Page utilitaire : hors sitemap et non indexée (aucune valeur SEO). */
export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
