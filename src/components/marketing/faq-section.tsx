import { ChevronDown } from "lucide-react";
import {
  formatStorage,
  getPlan,
  propertiesQuotaSentence,
} from "@/config/plans";

/**
 * FAQ accessible sans JavaScript : accordéon natif <details>/<summary>
 * (clavier, lecteurs d'écran et SEO pris en charge par le navigateur).
 *
 * Règles :
 * - les réponses ne décrivent que des fonctions réellement présentes ;
 * - aucun quota ni prix n'est ressaisi : tout vient de src/config/plans.ts ;
 * - l'état du paiement en ligne est celui du serveur (`isStripeConfigured`),
 *   jamais une affirmation figée dans le texte.
 */

export interface FaqItem {
  /** Repère stable, utilisé pour sélectionner un sous-ensemble (landing). */
  id?: string;
  question: string;
  answer: string;
}

const FREE_PLAN = getPlan("free");
const STARTER_PLAN = getPlan("starter");

/**
 * FAQ de la vitrine. `paymentsEnabled` reflète la configuration Stripe réelle
 * du serveur : tant qu'elle est fausse, aucune page n'annonce un paiement
 * disponible.
 */
export function getFaqItems({ paymentsEnabled }: { paymentsEnabled: boolean }): FaqItem[] {
  return [
    {
      id: "essai",
      question: "Comment fonctionne l'essai ?",
      answer:
        "Il n'y a pas d'essai limité dans le temps : le plan Gratuit est permanent. Créez votre compte sans carte bancaire, gérez un logement et un locataire actif aussi longtemps que vous voulez, puis passez à un plan supérieur quand votre patrimoine grandit.",
    },
    {
      id: "securite",
      question: "Mes données sont-elles sécurisées ?",
      answer:
        "Oui. Votre compte est protégé par authentification, chaque donnée est strictement isolée par utilisateur (un compte ne peut jamais lire les données d'un autre), et les fichiers sont stockés dans un espace privé servi par des liens signés à durée limitée. L'hébergement est situé en Europe.",
    },
    {
      id: "sauvegarde",
      question: "Comment fonctionne la sauvegarde ?",
      answer:
        "Chaque action est enregistrée immédiatement dans la base de données : il n'y a rien à sauvegarder manuellement, aucun fichier à gérer. Vos données sont conservées de manière durable et restent accessibles depuis n'importe quel appareil.",
    },
    {
      id: "changer_abonnement",
      question: "Puis-je changer d'abonnement ?",
      answer:
        "Oui, à tout moment et sans engagement : montée ou descente de gamme, effective immédiatement. Vos données restent intactes lors d'un changement de plan.",
    },
    {
      id: "supprimer_compte",
      question: "Comment supprimer mon compte ?",
      answer:
        "Depuis Paramètres → Compte, en confirmant avec votre mot de passe. La suppression est définitive : profil, logements, locataires, baux, loyers, documents, photos et abonnement sont intégralement effacés, conformément au RGPD.",
    },
    {
      id: "audience",
      question: "À qui s'adresse Nireo ?",
      answer:
        "Aux propriétaires bailleurs qui gèrent eux-mêmes leurs biens : un studio en location comme un patrimoine de plusieurs logements, en direct, en famille ou via une SCI. Nireo est un logiciel d'autogestion, pas une agence immobilière : il ne prend pas en charge la gestion à votre place.",
    },
    {
      id: "nb_logements",
      question: "Combien de logements puis-je gérer ?",
      answer: `Le nombre de logements dépend de votre plan — ${propertiesQuotaSentence()} Les locataires actifs suivent le nombre de logements, sauf sur le plan Gratuit, limité à ${FREE_PLAN.limits.maxActiveTenants} locataire actif.`,
    },
    {
      id: "depassement_logements",
      question: "Que se passe-t-il si je dépasse ma limite de logements ?",
      answer:
        "Vos logements existants restent accessibles. Vous ne pouvez simplement plus en ajouter de nouveaux tant que vous n'êtes pas passé au plan supérieur. La limite est appliquée côté serveur, pas seulement dans l'interface.",
    },
    {
      id: "paiements",
      question: "Les paiements en ligne sont-ils disponibles ?",
      answer: paymentsEnabled
        ? "Oui. Les abonnements sont souscrits depuis votre espace Abonnement, via Stripe : la page de paiement est hébergée par Stripe et Nireo ne voit jamais vos coordonnées bancaires. Chaque compte démarre malgré tout sur le plan Gratuit, sans carte bancaire."
        : "Pas encore : le paiement en ligne n'est pas ouvert sur cet environnement. Tous les comptes démarrent sur le plan Gratuit et vous pourrez souscrire un plan payant depuis votre espace Abonnement dès l'ouverture de la facturation.",
    },
    {
      id: "annuler",
      question: "Puis-je annuler mon abonnement ?",
      answer: paymentsEnabled
        ? "Oui, sans engagement. La résiliation se fait depuis votre espace Abonnement et prend effet à la fin de la période en cours. Vos données restent accessibles et vous pouvez les exporter avant de partir."
        : "Oui. Les abonnements sont sans engagement : la résiliation sera possible à tout moment depuis votre espace Abonnement, avec effet à la fin de la période en cours. Vous pouvez exporter vos données avant de partir.",
    },
    {
      id: "pro_vs_business",
      question: "Quelle différence entre les plans Pro et Business+ ?",
      answer: `Pro couvre ${getPlan("pro").limits.maxProperties} logements avec les statistiques avancées, les relances automatiques de loyer et le rapport mensuel par e-mail. Business+ ajoute la carte interactive du patrimoine, le centre de pilotage, l'accès anticipé aux nouvelles fonctions et le support prioritaire, jusqu'à ${getPlan("business").limits.maxProperties} logements.`,
    },
    {
      id: "documents_photos",
      question: "Puis-je stocker des PDF et des photos ?",
      answer: `Oui. Chaque logement dispose d'une bibliothèque de documents (baux, états des lieux, assurances, diagnostics, factures…) et d'une galerie de photos datées et classées, stockées dans un espace privé. Le plan Gratuit inclut ${formatStorage(FREE_PLAN.limits.storageMb)} de stockage, le plan Starter ${formatStorage(STARTER_PLAN.limits.storageMb)}.`,
    },
    {
      id: "plusieurs_locataires",
      question: "Puis-je gérer plusieurs locataires ?",
      answer:
        "Oui. Chaque logement porte son locataire et son bail (loyer, charges, dépôt de garantie, dates d'entrée et de sortie), et vous gérez autant de locataires que de logements autorisés par votre plan.",
    },
    {
      id: "loyers_depenses",
      question: "Puis-je suivre les loyers et les dépenses ?",
      answer:
        "Oui. Les échéances de loyer sont générées automatiquement chaque mois à partir des baux actifs (payé, en attente, en retard, partiel), et les dépenses sont classées par catégorie avec justificatifs. Le tableau de bord calcule revenus, dépenses et résultat net.",
    },
    {
      id: "fiscalite",
      question: "Nireo établit-il ma déclaration fiscale ?",
      answer:
        "Non. Nireo n'est ni un logiciel de comptabilité légale ni un outil de télédéclaration : il n'établit aucune déclaration et ne remplace pas un expert-comptable. Il centralise vos revenus, dépenses et justificatifs pour que vous, ou votre comptable, disposiez de chiffres à jour.",
    },
    {
      id: "mobile",
      question: "L'application fonctionne-t-elle sur mobile ?",
      answer:
        "Oui. Nireo est une application web responsive : elle s'utilise depuis un navigateur, sur ordinateur, tablette et smartphone, sans installation.",
    },
    {
      id: "export",
      question: "Puis-je exporter mes données ?",
      answer:
        "Oui. À partir du plan Starter, vous téléchargez à tout moment depuis les paramètres un export complet (JSON) et un export CSV de vos loyers. Quel que soit votre plan, vous pouvez demander la récupération de vos données au support avant une suppression de compte.",
    },
  ];
}

/**
 * Les cinq questions retenues pour la landing : offre gratuite, nombre de
 * logements, documents, sécurité des données, changement d'abonnement. Les
 * réponses restent celles de la FAQ générale — aucune n'est réécrite ici.
 */
const LANDING_FAQ_IDS = [
  "essai",
  "nb_logements",
  "documents_photos",
  "securite",
  "changer_abonnement",
] as const;

export function getLandingFaqItems({ paymentsEnabled }: { paymentsEnabled: boolean }): FaqItem[] {
  const all = getFaqItems({ paymentsEnabled });
  return LANDING_FAQ_IDS.map((id) => all.find((item) => item.id === id)).filter(
    (item): item is FaqItem => Boolean(item)
  );
}

/**
 * Accordéon de FAQ. Sans `items`, la FAQ générale de la vitrine est utilisée
 * (les guides passent leur propre liste).
 */
export function FaqSection({
  items,
  paymentsEnabled = false,
}: {
  items?: FaqItem[];
  paymentsEnabled?: boolean;
}) {
  const list = items ?? getFaqItems({ paymentsEnabled });
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
      {list.map((item) => (
        <details key={item.question} className="group px-5 py-1.5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          {/* Le dépliage est animé en CSS via ::details-content (globals.css) ;
              les navigateurs qui ne le connaissent pas ouvrent simplement d'un bloc. */}
          <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
