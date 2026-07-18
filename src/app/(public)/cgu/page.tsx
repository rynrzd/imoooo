import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Les règles d'utilisation du service ImmoPilot.",
  alternates: { canonical: "/cgu" },
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      updatedAt="15 juillet 2026"
      intro="Les présentes conditions encadrent l'utilisation d'ImmoPilot, logiciel de gestion locative destiné aux propriétaires bailleurs. En créant un compte, vous les acceptez."
      sections={[
        {
          title: "Objet du service",
          paragraphs: [
            "ImmoPilot permet de centraliser la gestion d'un patrimoine locatif : logements, locataires, baux, loyers, dépenses, travaux, documents et photos. ImmoPilot est un outil d'organisation et de suivi : il ne fournit ni conseil juridique, ni conseil fiscal, ni service de gestion locative déléguée.",
          ],
        },
        {
          title: "Compte utilisateur",
          paragraphs: [
            "La création d'un compte nécessite une adresse e-mail valide. Vous êtes responsable de la confidentialité de vos identifiants et de l'exactitude des données saisies.",
          ],
        },
        {
          title: "Plans et paiement",
          paragraphs: [
            "Le plan Gratuit est limité à un logement. Des plans payants (Starter, Pro, Business+) et une offre Fondateur à durée limitée élargissent ces limites. [À compléter : conditions de facturation, d'essai, de résiliation et de remboursement lors de l'activation du paiement en ligne.]",
          ],
        },
        {
          title: "Vos contenus",
          paragraphs: [
            "Les documents, photos et données que vous enregistrez restent votre propriété. Vous garantissez disposer du droit de les stocker (notamment pour les documents concernant vos locataires) et vous vous engagez à ne pas stocker de contenus illicites.",
          ],
        },
        {
          title: "Disponibilité",
          paragraphs: [
            "Le service est fourni « en l'état ». Nous nous efforçons d'assurer une disponibilité continue sans pouvoir la garantir (maintenances, incidents, dépendances techniques). Vous pouvez exporter vos données à tout moment.",
          ],
        },
        {
          title: "Responsabilité",
          paragraphs: [
            "Les indicateurs calculés (rendements, résultats, statistiques) sont fournis à titre informatif, sur la base des données que vous saisissez. Ils ne constituent pas un conseil en investissement et ne remplacent pas une comptabilité officielle. [À compléter : clauses de limitation de responsabilité validées juridiquement.]",
          ],
        },
        {
          title: "Résiliation",
          paragraphs: [
            "Vous pouvez cesser d'utiliser le service à tout moment. [À compléter : procédure de suppression de compte et sort des données après résiliation.]",
          ],
        },
      ]}
    />
  );
}
