import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import {
  companyNumbers,
  formattedAddress,
  hostingRegionSentence,
  HOSTING_PROVIDERS,
  LEGAL_IDENTITY,
  MISSING,
} from "@/config/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Informations légales relatives au site Nireo.",
  alternates: { canonical: "/mentions-legales" },
  robots: { index: false },
};

/**
 * Toutes les valeurs viennent de src/config/legal.ts : cette page ne contient
 * aucune information saisie en dur, donc aucune ne peut diverger des CGU ou
 * de la politique de confidentialité.
 */
export default function LegalNoticePage() {
  const host = HOSTING_PROVIDERS[0];

  return (
    <LegalPage
      title="Mentions légales"
      updatedAt="20 août 2026"
      intro="Informations légales relatives au site et au service Nireo, fournies conformément à la loi pour la confiance dans l'économie numérique (LCEN)."
      sections={[
        {
          title: "Éditeur du site",
          paragraphs: [
            `${LEGAL_IDENTITY.tradeName} est un service édité par ${LEGAL_IDENTITY.operatorName}, ${LEGAL_IDENTITY.legalForm.toLowerCase()}.`,
            `Adresse professionnelle : ${formattedAddress()}.`,
            companyNumbers(),
            `Téléphone : ${LEGAL_IDENTITY.phone} — Courriel : ${LEGAL_IDENTITY.email}`,
            LEGAL_IDENTITY.vatNumber
              ? `Numéro de TVA intracommunautaire : ${LEGAL_IDENTITY.vatNumber}`
              : MISSING(
                  "régime de TVA et, le cas échéant, numéro de TVA intracommunautaire. En l'absence de confirmation, aucune mention de TVA n'est affichée : une mention erronée sur ce point figurerait aussi sur les factures"
                ),
          ],
        },
        {
          title: "Directeur de la publication",
          paragraphs: [`${LEGAL_IDENTITY.directorOfPublication}.`],
        },
        {
          title: "Hébergement",
          paragraphs: [
            `Le site et l'application sont hébergés par ${host.name}, ${host.addressLines.join(", ")}.` +
              (host.phone
                ? ` Téléphone : ${host.phone}.`
                : " Cet hébergeur ne publie pas de numéro de téléphone ; il est joignable via " +
                  host.contact +
                  "."),
            `La base de données et les fichiers sont hébergés par ${HOSTING_PROVIDERS[1].name} (${HOSTING_PROVIDERS[1].contact}), qui ne publie pas d'adresse postale dans ses documents officiels.`,
            hostingRegionSentence(),
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
            `Pour toute question relative au site ou au service : ${LEGAL_IDENTITY.email}, ou ${LEGAL_IDENTITY.phone}.`,
          ],
        },
      ]}
    />
  );
}
