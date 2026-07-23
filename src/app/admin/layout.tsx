import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Administration",
    template: "%s · Admin Nireo",
  },
  // Espace privé : jamais indexé.
  robots: { index: false, follow: false },
};

/**
 * Segment /admin — coquille commune (connexion + panneau).
 * Thème sombre permanent : l'espace d'administration a son propre design,
 * indépendant du thème choisi par les utilisateurs de l'application.
 */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="dark min-h-svh bg-background text-foreground">
      {children}
    </div>
  );
}
