import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_IDENTITY, MISSING } from "@/config/legal";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Les règles d'utilisation du service Nireo.",
  alternates: { canonical: "/cgu" },
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      updatedAt="20 août 2026"
      intro="Les présentes conditions encadrent l'utilisation de Nireo, logiciel de gestion locative destiné aux propriétaires bailleurs. En créant un compte, vous les acceptez."
      sections={[
        {
          title: "Objet du service",
          paragraphs: [
            "Nireo permet de centraliser la gestion d'un patrimoine locatif : logements, locataires, baux, loyers, dépenses, travaux, documents et photos. Nireo est un outil d'organisation et de suivi : il ne fournit ni conseil juridique, ni conseil fiscal, ni service de gestion locative déléguée.",
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
            "Le plan Gratuit est limité à un logement. Des plans payants (Starter, Pro, Business+) et une offre Fondateur à durée limitée élargissent ces limites. Les tarifs en vigueur sont affichés sur la page Tarifs.",
            "Les abonnements sont mensuels, sans durée d'engagement, et reconduits automatiquement chaque mois jusqu'à résiliation. Vous pouvez résilier à tout moment : la résiliation prend effet à la fin de la période mensuelle déjà réglée, pendant laquelle le service reste accessible.",
            "Le paiement est traité par Stripe Payments Europe : Nireo n'a jamais accès à votre numéro de carte, qui n'est ni transmis ni stocké sur ses serveurs. La gestion de votre moyen de paiement, de vos factures et de la résiliation se fait depuis l'espace Abonnement, qui ouvre le portail sécurisé de Stripe.",
            "En cas d'échec de paiement, l'accès aux fonctionnalités du plan payant peut être suspendu jusqu'à régularisation. Vos données restent conservées et accessibles dans les limites du plan Gratuit ; elles ne sont pas supprimées de ce fait.",
          ],
        },
        {
          title: "Droit de rétractation",
          paragraphs: [
            "L'abonnement à Nireo est un contrat de prestation de services conclu à distance. À ce titre, si vous avez la qualité de consommateur, vous disposez d'un délai légal de quatorze (14) jours à compter de la conclusion du contrat pour exercer votre droit de rétractation, sans avoir à motiver votre décision ni à supporter de pénalité.",
            `Pour l'exercer, il suffit de nous notifier votre décision par une déclaration dénuée d'ambiguïté, avant l'expiration de ce délai : par courriel à ${LEGAL_IDENTITY.email}, ou par courrier à l'adresse indiquée dans les mentions légales. Vous pouvez utiliser le formulaire type de rétractation prévu par la réglementation, sans que ce soit obligatoire.`,
            "Le service étant accessible immédiatement après la souscription, vous demandez expressément, en souscrivant, que son exécution commence avant la fin du délai de rétractation. Vous conservez néanmoins votre droit de rétractation pendant ces quatorze jours ; si vous l'exercez alors que le service a déjà commencé à être fourni, vous êtes redevable d'un montant proportionnel à ce qui vous a été fourni jusqu'à la communication de votre décision, le solde vous étant remboursé.",
            "Le remboursement intervient au plus tard quatorze (14) jours après la date à laquelle nous sommes informés de votre décision, par le même moyen de paiement que celui utilisé lors de la souscription, sauf accord exprès pour un autre moyen et sans frais pour vous.",
            "Aucune garantie commerciale de remboursement ne s'ajoute à ces droits légaux : Nireo applique la réglementation applicable, ni plus restrictive, ni assortie d'une promesse supplémentaire.",
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
            "Le service est fourni « en l'état ». Nous nous efforçons d'assurer une disponibilité continue sans pouvoir la garantir (maintenances, incidents, dépendances techniques).",
            "L'export autonome de vos données (JSON et CSV), depuis Profil → Données et confidentialité, est inclus à partir du plan Starter. Quel que soit votre plan, y compris le plan Gratuit, vous pouvez obtenir une copie de vos données sur simple demande à l'adresse de contact : ce droit ne dépend d'aucun abonnement.",
          ],
        },
        {
          title: "Responsabilité",
          paragraphs: [
            "Les indicateurs calculés (rendements, résultats, statistiques) sont fournis à titre informatif, sur la base des données que vous saisissez. Ils ne constituent pas un conseil en investissement et ne remplacent pas une comptabilité officielle.",
            "Rien dans les présentes conditions ne limite les garanties légales de conformité et des vices cachés, ni la responsabilité de l'éditeur en cas de faute lourde ou dolosive, ni les droits que la loi reconnaît au consommateur.",
            MISSING(
              "clauses de limitation de responsabilité, à faire rédiger ou valider par un professionnel du droit — une clause limitative mal rédigée est réputée non écrite, et une clause abusive expose à une sanction"
            ),
          ],
        },
        {
          title: "Résiliation et suppression du compte",
          paragraphs: [
            "Vous pouvez cesser d'utiliser le service à tout moment. La suppression définitive de votre compte se demande depuis Profil → Données et confidentialité. Elle exige la saisie d'une phrase de confirmation et de votre mot de passe.",
            "Ce que la suppression effectue réellement, dans cet ordre : votre abonnement Stripe éventuel est résilié en premier, afin qu'aucun prélèvement ne survienne après la disparition du compte ; vos fichiers (documents, photos, justificatifs, pièces de chantier, avatar) sont supprimés du stockage ; puis votre compte est supprimé, ce qui efface en cascade vos logements, locataires, baux, loyers, dépenses, travaux, documents et notifications. Si l'une de ces étapes échoue, l'opération est interrompue et votre compte est conservé : vous en êtes informé plutôt que de vous retrouver avec des données à moitié effacées.",
            "Les notes privées et informations de garant saisies sur une fiche locataire sont enregistrées dans votre navigateur et non sur nos serveurs : elles ne sont donc pas concernées par cette suppression, et disparaissent en effaçant les données de navigation.",
            "La suppression du compte entraîne la résiliation de l'abonnement en cours ; la période déjà réglée n'est pas remboursée au prorata, en dehors de l'exercice du droit de rétractation décrit plus haut.",
            MISSING(
              "délai maximal de purge des sauvegardes après suppression, et durée de conservation des données de facturation imposée par les obligations comptables applicables"
            ),
          ],
        },
        {
          title: "Réclamations et médiation de la consommation",
          paragraphs: [
            `Toute réclamation peut être adressée à ${LEGAL_IDENTITY.email} ou au ${LEGAL_IDENTITY.phone}. Nous nous efforçons d'y répondre dans les meilleurs délais.`,
            "Si aucune solution amiable n'est trouvée, le consommateur peut recourir gratuitement à un médiateur de la consommation en vue de la résolution du litige.",
            MISSING(
              "nom et coordonnées du médiateur de la consommation auquel l'éditeur adhère, ainsi que l'adresse de son site — l'adhésion à un dispositif de médiation est une obligation pour tout professionnel vendant à des consommateurs, et aucun organisme ne peut être désigné ici sans que l'adhésion ait réellement été souscrite"
            ),
            "La plateforme européenne de règlement en ligne des litiges est par ailleurs accessible à l'adresse https://ec.europa.eu/consumers/odr.",
          ],
        },
        {
          title: "Droit applicable",
          paragraphs: [
            "Les présentes conditions sont soumises au droit français. Les dispositions protectrices du consommateur prévues par la loi de son pays de résidence lui restent acquises.",
          ],
        },
      ]}
    />
  );
}
