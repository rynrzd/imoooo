import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Politique de cookies",
  description: "Les cookies utilisés par Noviqo et leur finalité.",
  alternates: { canonical: "/cookies" },
  robots: { index: false },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique de cookies"
      updatedAt="17 juillet 2026"
      intro="Noviqo utilise uniquement des cookies strictement nécessaires au fonctionnement du service. Aucun cookie publicitaire, statistique ou de pistage tiers n'est déposé — c'est pourquoi aucune bannière de consentement n'est requise à ce jour."
      sections={[
        {
          title: "Cookies strictement nécessaires",
          paragraphs: [
            "Cookies d'authentification Supabase (session sécurisée) : ils maintiennent votre connexion et protègent l'accès à vos données. Ils sont indispensables au service et exemptés de consentement au sens des recommandations CNIL.",
          ],
        },
        {
          title: "Stockage local (non-cookie)",
          paragraphs: [
            "Le navigateur conserve localement certaines préférences d'interface (thème clair/sombre, visite guidée effectuée). Ces informations ne quittent pas votre appareil et ne permettent aucun suivi.",
          ],
        },
        {
          title: "Cookies statistiques et marketing",
          paragraphs: [
            "Aucun à ce jour. Si un outil de mesure d'audience ou de marketing était ajouté à l'avenir, une bannière de consentement conforme (accepter / refuser / personnaliser) serait mise en place AVANT tout dépôt, et cette page serait mise à jour. [À faire valider par un professionnel du droit avant la mise en production.]",
          ],
        },
        {
          title: "Gérer les cookies",
          paragraphs: [
            "Vous pouvez supprimer les cookies depuis les réglages de votre navigateur. La suppression des cookies d'authentification vous déconnectera de Noviqo.",
          ],
        },
      ]}
    />
  );
}
