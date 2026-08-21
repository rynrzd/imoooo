import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutContent } from "@/components/marketing/about-content";
import { getPublicCompanyProfile } from "@/lib/admin/company";

export const metadata: Metadata = {
  title: "Entreprise",
  description:
    "Découvrez Nireo : notre histoire, notre vision, nos valeurs, l'équipe et pourquoi travailler avec nous.",
  // Contenu identique à /a-propos → on consolide le SEO vers la route canonique.
  alternates: { canonical: "/a-propos" },
  // Partage social : le titre propre à la page, pas le slogan du layout racine.
  // L'URL reste la route canonique, comme pour `alternates`.
  openGraph: {
    type: "website",
    url: "/a-propos",
    title: "Entreprise",
    description:
      "Découvrez Nireo : notre histoire, notre vision, nos valeurs, l'équipe et pourquoi travailler avec nous.",
  },
};

/**
 * Rendu DYNAMIQUE : la vitrine reflète en direct le contenu édité dans
 * /admin/entreprise (pas de figeage au build). Voir /a-propos.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /entreprise — vitrine PUBLIQUE (accessible sans connexion), identique à
 * /a-propos. Lien « partageable » mis en avant dans /admin/entreprise.
 */
export default async function EntreprisePage() {
  const profile = await getPublicCompanyProfile();
  if (!profile.published) notFound();
  return <AboutContent profile={profile} />;
}
