import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutContent } from "@/components/marketing/about-content";
import { getPublicCompanyProfile } from "@/lib/admin/company";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez Nireo : notre histoire, notre vision, nos valeurs, l'équipe et pourquoi travailler avec nous.",
  alternates: { canonical: "/a-propos" },
};

/**
 * /a-propos — vitrine officielle de Nireo, alimentée par le contenu éditable
 * depuis /admin/entreprise. Sections vides masquées automatiquement.
 */
export default async function AboutPage() {
  const profile = await getPublicCompanyProfile();
  if (!profile.published) notFound();
  return <AboutContent profile={profile} />;
}
