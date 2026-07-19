import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment Noviqo collecte, utilise et protège vos données.",
  alternates: { canonical: "/confidentialite" },
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="15 juillet 2026"
      intro="Cette politique décrit les données traitées par Noviqo et l'usage qui en est fait. Elle repose sur un principe simple : vos données de gestion locative vous appartiennent et ne servent qu'à faire fonctionner le service."
      sections={[
        {
          title: "Données collectées",
          paragraphs: [
            "Données de compte : adresse e-mail, nom, téléphone (facultatif), mot de passe (stocké sous forme chiffrée par notre prestataire d'authentification).",
            "Données de gestion saisies par vous : logements, locataires, baux, loyers, dépenses, travaux, documents et photos. Ces données ne sont ni analysées à des fins commerciales, ni revendues, ni partagées avec des tiers à des fins publicitaires.",
          ],
        },
        {
          title: "Finalités",
          paragraphs: [
            "Les données servent exclusivement à fournir le service : afficher votre patrimoine, calculer vos indicateurs, stocker vos documents et vous authentifier.",
          ],
        },
        {
          title: "Hébergement et sous-traitants",
          paragraphs: [
            "Les données sont hébergées par Supabase (base de données et stockage de fichiers). Les fichiers sont conservés dans des espaces privés, accessibles uniquement via des liens signés à durée limitée. [À compléter : région d'hébergement retenue et liste définitive des sous-traitants.]",
          ],
        },
        {
          title: "Isolation des données",
          paragraphs: [
            "Chaque donnée est rattachée à votre compte et protégée par des règles d'accès appliquées au niveau de la base de données (Row Level Security) : un utilisateur ne peut ni lire ni modifier les données d'un autre.",
          ],
        },
        {
          title: "Durée de conservation",
          paragraphs: [
            "Vos données sont conservées tant que votre compte est actif. Vous pouvez exporter vos données à tout moment depuis les paramètres (JSON et CSV). [À compléter : procédure de suppression définitive du compte et délais de purge.]",
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            "Conformément au RGPD, vous disposez de droits d'accès, de rectification, d'effacement et de portabilité sur vos données. Pour les exercer, contactez-nous à l'adresse indiquée en bas de page. [À compléter : identité du responsable de traitement.]",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "Noviqo utilise uniquement des cookies techniques nécessaires à l'authentification et au maintien de votre session. Aucun cookie publicitaire ou de pistage tiers n'est déposé.",
          ],
        },
      ]}
    />
  );
}
