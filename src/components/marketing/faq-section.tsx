import { ChevronDown } from "lucide-react";

/**
 * FAQ accessible sans JavaScript : accordéon natif <details>/<summary>
 * (clavier, lecteurs d'écran et SEO pris en charge par le navigateur).
 * Les réponses ne décrivent que des fonctions réellement présentes.
 */

export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Comment fonctionne l'essai ?",
    answer:
      "Il n'y a pas d'essai limité dans le temps : le plan Gratuit est permanent. Créez votre compte sans carte bancaire, gérez un logement et un locataire actif aussi longtemps que vous voulez, puis passez à un plan supérieur quand votre patrimoine grandit.",
  },
  {
    question: "Mes données sont-elles sécurisées ?",
    answer:
      "Oui. Votre compte est protégé par authentification, chaque donnée est strictement isolée par utilisateur (un compte ne peut jamais lire les données d'un autre), et les fichiers sont stockés dans un espace privé servi par des liens signés à durée limitée. L'hébergement est situé en Europe.",
  },
  {
    question: "Comment fonctionne la sauvegarde ?",
    answer:
      "Chaque action est enregistrée immédiatement dans la base de données : il n'y a rien à sauvegarder manuellement, aucun fichier à gérer. Vos données sont conservées de manière durable et restent accessibles depuis n'importe quel appareil.",
  },
  {
    question: "Puis-je changer d'abonnement ?",
    answer:
      "Oui, à tout moment et sans engagement : montée ou descente de gamme, effective immédiatement. Vos données restent intactes lors d'un changement de plan.",
  },
  {
    question: "Comment supprimer mon compte ?",
    answer:
      "Depuis Paramètres → Compte, en confirmant avec votre mot de passe. La suppression est définitive : profil, logements, locataires, baux, loyers, documents, photos et abonnement sont intégralement effacés, conformément au RGPD.",
  },
  {
    question: "À qui s'adresse Nireo ?",
    answer:
      "Aux propriétaires bailleurs qui gèrent eux-mêmes leurs biens : un studio en location comme un patrimoine de plusieurs logements, en direct, en famille ou via une SCI. Aucune compétence comptable n'est requise.",
  },
  {
    question: "Combien de logements puis-je gérer ?",
    answer:
      "1 logement avec le plan Gratuit, jusqu'à 10 avec Starter, jusqu'à 30 avec Pro. Le plan Business+ n'a pas de limite de logements.",
  },
  {
    question: "Que se passe-t-il si je dépasse ma limite de logements ?",
    answer:
      "Vos logements existants restent accessibles. Vous ne pouvez simplement plus en ajouter de nouveaux tant que vous n'êtes pas passé au plan supérieur.",
  },
  {
    question: "Les paiements en ligne sont-ils déjà disponibles ?",
    answer:
      "Pas encore : le paiement en ligne arrive bientôt. En attendant, tous les comptes démarrent sur le plan Gratuit — vous pourrez souscrire un plan payant depuis votre espace dès l'ouverture de la facturation.",
  },
  {
    question: "Puis-je annuler ?",
    answer:
      "Oui. Les abonnements seront sans engagement : résiliation possible à tout moment, effective à la fin de la période en cours. Vous pouvez exporter vos données avant de partir.",
  },
  {
    question: "Le plan Business est-il disponible ?",
    answer:
      "Il est en préparation (multi-utilisateurs, rôles et permissions). Contactez-nous pour discuter de vos besoins : nous construisons cette offre avec les premières équipes intéressées.",
  },
  {
    question: "Puis-je stocker des PDF et des photos ?",
    answer:
      "Oui. Chaque logement dispose d'une bibliothèque de documents (baux, diagnostics, assurances, factures…) et d'une galerie de photos datées et classées (états des lieux, travaux, dommages), stockées dans un espace privé.",
  },
  {
    question: "Puis-je gérer plusieurs locataires ?",
    answer:
      "Oui. Chaque logement porte son locataire et son bail (loyer, charges, dépôt de garantie, dates d'entrée et de sortie), et vous gérez autant de locataires que de logements dans votre plan.",
  },
  {
    question: "Puis-je suivre les loyers et les dépenses ?",
    answer:
      "Oui. Les échéances de loyer sont générées automatiquement chaque mois (payé, en attente, en retard, partiel), et les dépenses sont classées par catégorie avec justificatifs. Le tableau de bord calcule revenus, dépenses et résultat net.",
  },
  {
    question: "L'application fonctionne-t-elle sur mobile ?",
    answer:
      "Oui. Nireo est une application web responsive : elle s'utilise depuis un navigateur, sur ordinateur, tablette et smartphone, sans installation.",
  },
  {
    question: "Puis-je exporter mes données ?",
    answer:
      "Oui. À partir du plan Starter, vous téléchargez à tout moment depuis les paramètres un export complet (JSON) et un export CSV de vos loyers. Quel que soit votre plan, vous pouvez demander la récupération de vos données au support avant une suppression de compte.",
  },
];

export function FaqSection() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
      {FAQ_ITEMS.map((item) => (
        <details key={item.question} className="group px-5 py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
