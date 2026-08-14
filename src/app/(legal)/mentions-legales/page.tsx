import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Informations légales relatives au site Nireo.",
  alternates: { canonical: "/mentions-legales" },
  robots: { index: false },
};

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedAt="15 juillet 2026"
      intro="Informations légales relatives au site et au service Nireo, fournies conformément à la loi pour la confiance dans l'économie numérique (LCEN)."
      sections={[
        {
          title: "Éditeur du site",
          paragraphs: [
            "[À compléter avant l'ouverture commerciale : nom ou raison sociale de l'éditeur, forme juridique, adresse, numéro SIREN/SIRET, capital social le cas échéant, et identité du directeur de la publication.]",
          ],
        },
        {
          title: "Hébergement",
          paragraphs: [
            "Application et données hébergées par Supabase, Inc. — https://supabase.com. [À compléter : hébergeur du site web (ex. Vercel) et région d'hébergement retenue une fois le déploiement de production choisi.]",
          ],
        },
        {
          title: "Propriété intellectuelle",
          paragraphs: [
            "La marque Nireo, l'interface et ses contenus sont protégés. Toute reproduction non autorisée est interdite. Les données saisies par les utilisateurs restent leur propriété.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            "L'adresse de contact figure en bas de cette page et dans le pied de page du site.",
          ],
        },
      ]}
    />
  );
}
