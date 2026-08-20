import type { Metadata } from "next";
import Link from "next/link";
import { FaqSection, type FaqItem } from "@/components/marketing/faq-section";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import {
  ComparisonTable,
  ContentColumn,
  ContentCta,
  ContentHeader,
  ContentList,
  ContentNotice,
  ContentPageShell,
  ContentSection,
  ContentSubtitle,
  RelatedPages,
  StepList,
} from "@/components/seo/content";
import { JsonLd } from "@/components/seo/json-ld";
import { getPlan, propertiesLabel } from "@/config/plans";
import { PILLAR_PAGE, RESOURCES_PAGE, getGuide, otherGuides } from "@/config/seo-pages";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/supabase/config";

const PAGE = getGuide("/meilleur-logiciel-gestion-locative");
const FREE = getPlan("free");

export const metadata: Metadata = {
  title: { absolute: `${PAGE.title} | Nireo` },
  description: PAGE.description,
  alternates: { canonical: PAGE.path },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: PAGE.path,
    title: PAGE.title,
    description: PAGE.description,
  },
};

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: RESOURCES_PAGE.shortTitle, path: RESOURCES_PAGE.path },
  { name: PAGE.shortTitle, path: PAGE.path },
];

const FAQ: FaqItem[] = [
  {
    question: "Quel est le meilleur logiciel de gestion locative ?",
    answer:
      "Il n'existe pas de meilleur logiciel universel. Le bon choix dépend du nombre de biens, des tâches que vous réalisez, du niveau d'automatisation attendu, de votre besoin d'accompagnement et de votre budget. Une solution doit être évaluée sur un cas réel, pas seulement sur sa liste de fonctions.",
  },
  {
    question: "Quel outil choisir pour un seul logement ?",
    answer:
      "Un tableur peut suffire si le locataire est stable, que les documents sont peu nombreux et que le suivi reste simple. Un logiciel devient utile si vous voulez relier loyers, bail, dépenses, justificatifs et historique sans maintenir vous-même des fichiers et des formules.",
  },
  {
    question: "Un logiciel de gestion locative gratuit suffit-il ?",
    answer: `Il peut suffire pour démarrer si ses limites correspondent à votre situation. Le plan ${FREE.name} de Nireo couvre ${propertiesLabel(FREE)} et un locataire actif, sans limite de durée. Vérifiez toujours les quotas, l'export des données et les fonctions réservées aux offres payantes.`,
  },
  {
    question: "Nireo est-il le meilleur logiciel de gestion locative ?",
    answer:
      "Pas pour tout le monde. Nireo est conçu pour les propriétaires qui gèrent eux-mêmes leurs biens et veulent centraliser leur suivi. Il ne convient pas si vous cherchez une agence qui réalise les démarches à votre place, un service d'encaissement des loyers ou un logiciel de comptabilité et de déclaration fiscale.",
  },
  {
    question: "Que faut-il tester avant de payer ?",
    answer:
      "Créez un vrai logement, ajoutez son bail, enregistrez un encaissement et une dépense, déposez un document, consultez le résultat sur téléphone puis vérifiez les possibilités d'export et de suppression du compte. Ce parcours révèle mieux l'adéquation qu'une démonstration théorique.",
  },
];

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  articleJsonLd({
    headline: PAGE.title,
    description: PAGE.description,
    path: PAGE.path,
    datePublished: PAGE.updatedAt,
    dateModified: PAGE.updatedAt,
  }),
  breadcrumbJsonLd(CRUMBS),
  faqPageJsonLd(FAQ, `${SITE_URL}${PAGE.path}`),
]);

function Inline({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="nl-focus font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

export default function MeilleurLogicielGestionLocativePage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide de choix 2026"
          h1="Meilleur logiciel de gestion locative en 2026 : comment choisir"
          lead="Le meilleur outil n'est pas celui qui promet le plus de fonctions : c'est celui qui correspond à votre manière de gérer et dont les limites sont claires. Cette grille vous aide à comparer sans classement artificiel — y compris pour savoir si Nireo vous convient ou non."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="pas-de-classement-universel" title="Il n'existe pas de numéro 1 pour tous les bailleurs">
          <p>
            Une recherche du « meilleur logiciel de gestion locative » mélange
            souvent des besoins très différents : suivre un studio, administrer
            une SCI familiale, piloter vingt logements ou déléguer entièrement
            la gestion. Une note globale ne dit pas si l&apos;outil répond à
            votre situation.
          </p>
          <p>
            Commencez donc par votre usage. Le bon logiciel doit supprimer des
            tâches réelles, garder vos données compréhensibles et annoncer
            clairement ce qu&apos;il ne prend pas en charge.
          </p>
          <ContentNotice title="Méthode de cette page">
            <p>
              Nireo édite ce guide et présente donc son propre produit. Nous ne
              publions pas un faux podium de concurrents. Les critères
              ci-dessous sont vérifiables et la dernière section indique
              explicitement les situations où Nireo est — ou n&apos;est pas —
              adapté.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection id="criteres" title="8 critères pour comparer les logiciels">
          <ContentSubtitle>1. Votre profil et le nombre de logements</ContentSubtitle>
          <p>
            Vérifiez la limite de biens et de locataires actifs de chaque offre,
            puis regardez le palier suivant. Un tarif attractif aujourd&apos;hui
            peut devenir inadapté lorsque vous ajoutez un logement.
          </p>

          <ContentSubtitle>2. Les tâches réellement couvertes</ContentSubtitle>
          <p>
            Listez ce que vous faites chaque mois : échéances, encaissements,
            relances, quittances, dépenses, travaux, documents et indicateurs.
            Une fonction n&apos;a de valeur que si elle évite une ressaisie ou
            sécurise une information que vous utilisez.
          </p>

          <ContentSubtitle>3. Le niveau d&apos;automatisation</ContentSubtitle>
          <p>
            Distinguez une simple zone de saisie d&apos;une automatisation réelle.
            Par exemple, un statut de loyer peut être choisi manuellement ou
            calculé à partir du montant attendu et de l&apos;encaissement reçu.
          </p>

          <ContentSubtitle>4. Les limites juridiques et fiscales</ContentSubtitle>
          <p>
            Un outil de suivi, un logiciel comptable et une agence ne rendent
            pas le même service. Vérifiez qui rédige les documents, qui exécute
            les démarches et si une déclaration fiscale est réellement produite.
          </p>

          <ContentSubtitle>5. La propriété et l&apos;export des données</ContentSubtitle>
          <p>
            Demandez quels formats peuvent être exportés, à partir de quelle
            offre et ce qui se passe après une résiliation. Les données doivent
            rester récupérables dans une forme exploitable.
          </p>

          <ContentSubtitle>6. La sécurité et les accès</ContentSubtitle>
          <p>
            Contrôlez l&apos;authentification, l&apos;isolation entre comptes, le
            caractère privé des fichiers, la localisation annoncée de
            l&apos;hébergement et la procédure de suppression du compte.
          </p>

          <ContentSubtitle>7. Le prix complet</ContentSubtitle>
          <p>
            Comparez le prix au bon nombre de logements et aux fonctions dont
            vous avez besoin. Regardez aussi les quotas de stockage, documents
            et photos, ainsi que les fonctions d&apos;export ou de relance.
          </p>

          <ContentSubtitle>8. L&apos;usage sur mobile et au quotidien</ContentSubtitle>
          <p>
            Un outil rarement ouvert n&apos;améliore rien. Testez les opérations
            courantes sur ordinateur et téléphone, la lisibilité des statuts et
            le temps nécessaire pour retrouver un bail ou une facture.
          </p>
        </ContentSection>

        <ContentSection id="approches" title="Tableur, logiciel ou agence : quelle approche choisir ?">
          <ComparisonTable
            caption="Choix entre un tableur et un logiciel de gestion locative"
            leftLabel="Tableur"
            rightLabel="Logiciel dédié"
            rows={[
              {
                criterion: "Bon choix si…",
                left: "Le suivi est simple, peu volumineux et maîtrisé par une seule personne.",
                right: "Vous voulez relier loyers, bail, dépenses, documents et historique.",
              },
              {
                criterion: "Automatisation",
                left: "Formules, rappels et statuts sont créés et entretenus par vous.",
                right: "Certaines échéances, alertes, statuts et statistiques sont calculés par l'application.",
              },
              {
                criterion: "Documents",
                left: "Ils restent dans des dossiers séparés du suivi financier.",
                right: "Ils peuvent être rattachés au logement ou à l'opération concernée.",
              },
              {
                criterion: "Coût",
                left: "Faible ou nul, mais le temps de maintenance reste à votre charge.",
                right: "Abonnement éventuel à comparer avec les tâches réellement évitées.",
              },
              {
                criterion: "Responsabilité",
                left: "Vous gérez et vérifiez tout.",
                right: "Vous restez responsable : le logiciel organise mais n'agit pas comme une agence.",
              },
            ]}
          />
          <p>
            Si vous souhaitez qu&apos;un professionnel recherche les locataires,
            réalise les démarches et gère la relation au quotidien, comparez
            une agence ou un administrateur de biens. Ce service ne se compare
            pas uniquement au prix d&apos;un logiciel : son périmètre est plus
            large.
          </p>
          <p>
            Si votre difficulté principale est la dispersion entre plusieurs
            fichiers, consultez aussi le guide{" "}
            <Inline href="/alternative-excel-gestion-locative">
              alternative à Excel pour la gestion locative
            </Inline>.
          </p>
        </ContentSection>

        <ContentSection id="test" title="Le test décisif en 30 minutes">
          <p>
            Avant de choisir une offre payante, reproduisez un petit parcours
            avec vos propres données. Vous saurez rapidement si l&apos;outil vous
            fait gagner du temps ou ajoute une nouvelle couche de saisie.
          </p>
          <StepList
            steps={[
              {
                title: "Reproduire un bien",
                description:
                  "Créez un logement réel, son locataire et les conditions du bail en cours.",
              },
              {
                title: "Faire un mois complet",
                description:
                  "Enregistrez un loyer, une dépense et un document, puis contrôlez les totaux et statuts.",
              },
              {
                title: "Tester la sortie",
                description:
                  "Consultez sur téléphone, cherchez un justificatif et vérifiez les modalités d'export et de suppression.",
              },
            ]}
          />
        </ContentSection>

        <ContentSection id="nireo" title="Nireo est-il adapté à votre situation ?">
          <p>
            Nireo est un{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>{" "}
            pour propriétaires bailleurs en autogestion. Il centralise les
            logements, locataires, baux, échéances, encaissements, documents,
            photos, dépenses et travaux, puis calcule les principaux indicateurs
            à partir de ces données.
          </p>
          <ContentSubtitle>Nireo peut être un bon choix si :</ContentSubtitle>
          <ContentList
            items={[
              "vous gérez vous-même un ou plusieurs logements ;",
              "vous voulez remplacer plusieurs fichiers et dossiers par un espace lié à chaque bien ;",
              "vous souhaitez suivre les loyers, dépenses, travaux et justificatifs au même endroit ;",
              "vous préférez commencer par un plan gratuit avant de choisir une offre ;",
              "une application web utilisable sur ordinateur et mobile répond à votre usage.",
            ]}
          />
          <ContentSubtitle>Nireo n&apos;est probablement pas le bon choix si :</ContentSubtitle>
          <ContentList
            items={[
              "vous cherchez une agence qui gère les locations à votre place ;",
              "vous attendez la recherche d'un locataire, la rédaction du bail ou la réalisation de l'état des lieux ;",
              "vous voulez que la plateforme encaisse directement les loyers pour votre compte ;",
              "vous avez besoin d'une comptabilité légale ou d'une déclaration fiscale produite automatiquement ;",
              "vous ne souhaitez effectuer aucune saisie ni vérification vous-même.",
            ]}
          />
          <p>
            Le plan {FREE.name} couvre {propertiesLabel(FREE)} et un locataire
            actif sans limite de durée. Les quotas et fonctions actualisés sont
            détaillés sur la page <Inline href="/tarifs">Tarifs</Inline> et
            dans le guide <Inline href="/logiciel-gestion-locative-gratuit">
              logiciel de gestion locative gratuit
            </Inline>.
          </p>
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title="Comparez Nireo sur un vrai logement"
          description={`Le plan ${FREE.name} permet de tester ${propertiesLabel(FREE)} sans carte bancaire et sans limite de durée. Évaluez-le avec la grille de cette page avant de décider.`}
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
