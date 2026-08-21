import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutContent } from "@/components/marketing/about-content";
import { getPublicCompanyProfile } from "@/lib/admin/company";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez Nireo : notre histoire, notre vision, nos valeurs, l'équipe et pourquoi travailler avec nous.",
  alternates: { canonical: "/a-propos" },
  // Sans ceci, un partage de cette page affiche le titre générique du layout
  // racine au lieu du sien.
  openGraph: {
    type: "website",
    url: "/a-propos",
    title: "À propos",
    description:
      "Découvrez Nireo : notre histoire, notre vision, nos valeurs, l'équipe et pourquoi travailler avec nous.",
  },
};

/**
 * Rendu DYNAMIQUE obligatoire : la vitrine doit refléter en direct le contenu
 * édité dans /admin/entreprise. Sans ceci, Next fige la page au build (elle
 * apparaissait dans prerender-manifest.json) et aucune modification admin ne
 * s'affiche sans redéploiement. Page marketing à faible trafic → coût négligeable.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /a-propos — vitrine officielle de Nireo, alimentée par le contenu éditable
 * depuis /admin/entreprise. Sections vides masquées automatiquement.
 */
export default async function AboutPage() {
  const profile = await getPublicCompanyProfile();
  if (!profile.published) notFound();
  return <AboutContent profile={profile} />;
}
