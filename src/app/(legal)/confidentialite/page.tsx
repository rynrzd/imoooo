import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import {
  formattedAddress,
  hostingRegionSentence,
  LEGAL_IDENTITY,
  MISSING,
} from "@/config/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment Nireo collecte, utilise et protège vos données.",
  alternates: { canonical: "/confidentialite" },
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="20 août 2026"
      intro="Cette politique décrit les données traitées par Nireo et l'usage qui en est fait. Elle repose sur un principe simple : vos données de gestion locative vous appartiennent et ne servent qu'à faire fonctionner le service."
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
            "Les données sont hébergées par Supabase (base de données et stockage de fichiers). Les fichiers sont conservés dans des espaces privés : ils ne sont jamais accessibles par une adresse publique, et chaque consultation passe par un lien signé valable une heure.",
            "Les autres prestataires qui interviennent dans le fonctionnement du service sont : Vercel (hébergement de l'application et journaux techniques), Stripe Payments Europe (paiement des abonnements — Nireo n'a jamais accès à votre numéro de carte), Resend (envoi des e-mails du service, région de traitement : Union européenne) et Cloudflare Turnstile (protection des formulaires de connexion contre les robots). Aucun outil publicitaire ni de mesure d'audience tiers n'est utilisé.",
            hostingRegionSentence(),
          ],
        },
        {
          title: "Isolation des données",
          paragraphs: [
            "Chaque donnée est rattachée à votre compte et protégée par des règles d'accès appliquées au niveau de la base de données (Row Level Security) : un utilisateur ne peut ni lire ni modifier les données d'un autre.",
          ],
        },
        {
          title: "Durée de conservation et suppression",
          paragraphs: [
            "Vos données sont conservées tant que votre compte est actif.",
            "La suppression définitive se demande depuis Profil → Données et confidentialité ; elle exige une phrase de confirmation et votre mot de passe. Elle résilie d'abord l'abonnement en cours, supprime ensuite l'ensemble de vos fichiers du stockage, puis supprime le compte lui-même — ce qui efface en cascade logements, locataires, baux, loyers, dépenses, travaux, documents et notifications. Si une étape échoue, l'opération s'interrompt et le compte est conservé plutôt que partiellement effacé.",
            MISSING(
              "délai maximal de purge des sauvegardes après suppression, et durée de conservation des données de facturation imposée par les obligations comptables"
            ),
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            `Le responsable de traitement est ${LEGAL_IDENTITY.operatorName} (${LEGAL_IDENTITY.legalForm.toLowerCase()}), éditeur du service Nireo — ${formattedAddress()}. Contact : ${LEGAL_IDENTITY.email}, ${LEGAL_IDENTITY.phone}. Aucun délégué à la protection des données n'a été désigné, sa désignation n'étant pas obligatoire au regard de l'activité exercée.`,
            "Conformément au RGPD, vous disposez de droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité sur vos données. Pour les exercer, écrivez-nous à l'adresse ci-dessus : ces droits s'exercent gratuitement, sur tous les plans, y compris le plan Gratuit, et ne dépendent d'aucun abonnement.",
            "L'outil d'export autonome (JSON et CSV), disponible depuis Profil → Données et confidentialité, est une commodité incluse à partir du plan Starter ; il ne conditionne pas votre droit à la portabilité, que nous honorons sur demande quel que soit votre plan. La suppression de votre compte, elle, est accessible sur tous les plans.",
            "Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — www.cnil.fr.",
          ],
        },
        {
          title: "Nireo ID — suivi des téléphones",
          paragraphs: [
            "Nireo ID traite les informations que vous saisissez sur un téléphone : marque, modèle, date d'achat, état déclaré, réparations, documents joints et, si vous le souhaitez, numéro de série ou IMEI. Ces identifiants restent privés : ils ne sont jamais affichés en entier dans un rapport partagé ni dans un aperçu public, et servent uniquement à détecter qu'un même appareil n'est pas enregistré deux fois.",
            "Bilans : lorsque vous ou votre entreprise activez les bilans réguliers, un lien personnel est envoyé à l'adresse du détenteur du téléphone. Ce lien est limité à un appareil, expire et peut être révoqué. La réponse enregistre uniquement l'état matériel déclaré.",
            "Téléphones professionnels : une entreprise voit l'état matériel du téléphone qu'elle possède, son détenteur déclaré et ses réparations. Nireo ID ne collecte et ne transmet AUCUNE donnée d'usage personnel : ni appels, ni messages, ni photos personnelles, ni applications, ni navigation, ni position, ni temps d'écran. Ce n'est pas un outil de surveillance.",
            "Téléphone personnel utilisé au travail : vous restez propriétaire de la fiche. L'entreprise n'obtient qu'un accès explicitement accordé, et aucun document privé n'est partagé automatiquement.",
            "Réparateurs : un atelier n'accède qu'à l'intervention que vous lui confiez, pour une durée limitée et révocable. Il ne voit ni vos autres téléphones, ni vos documents privés.",
            "Transfert : lorsque vous cédez un téléphone, l'historique de l'appareil suit l'appareil. Vos documents privés, vos coordonnées et les noms des personnes qui l'ont utilisé ne sont jamais transmis automatiquement.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "Nireo dépose des cookies techniques, nécessaires à l'authentification et au maintien de votre session, ainsi que — uniquement si vous les acceptez — des cookies de mesure de fréquentation et de personnalisation de la page d'accueil. Aucun cookie publicitaire ni aucun traceur tiers n'est déposé.",
            "Le détail de chaque cookie, sa durée et sa finalité figurent dans la politique de cookies, où vous pouvez également accepter ou refuser les cookies de mesure et revenir sur ce choix à tout moment.",
          ],
        },
      ]}
    />
  );
}
