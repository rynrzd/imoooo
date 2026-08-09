import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
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
} from "@/components/seo/content";
import { FaqSection, type FaqItem } from "@/components/marketing/faq-section";
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

const PAGE = getGuide("/gestion-locative-sci");
const STARTER = getPlan("starter");
const PRO = getPlan("pro");
const BUSINESS = getPlan("business");

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
    question: "Nireo est-il un logiciel de comptabilité pour SCI ?",
    answer:
      "Non, et c'est important : Nireo ne tient pas de comptabilité au sens légal. Il ne produit ni journal, ni grand livre, ni balance, ni bilan, ni compte de résultat, et n'effectue aucune télédéclaration. Il centralise les loyers, les dépenses et les justificatifs pour que ces chiffres soient disponibles et à jour — la comptabilité de la société reste à la charge du gérant et de son comptable.",
  },
  {
    question: "Nireo établit-il la déclaration fiscale de ma SCI ?",
    answer:
      "Non. Nireo ne remplit aucun formulaire fiscal, ne calcule aucun impôt et n'établit aucune déclaration, quelle que soit l'option fiscale de la société.",
  },
  {
    question: "Plusieurs associés peuvent-ils accéder au même espace ?",
    answer:
      "Non. Les données de Nireo sont rattachées à un compte propriétaire, seul à y accéder : il n'existe aujourd'hui ni partage d'un patrimoine entre plusieurs comptes, ni gestion de rôles ou de permissions. En pratique, l'espace est tenu par la personne qui assure la gestion courante — souvent le gérant.",
  },
  {
    question: "Peut-on séparer les biens détenus en direct de ceux de la SCI ?",
    answer:
      "Il n'existe pas d'entité « société » dans le modèle de données : tous les logements d'un compte figurent dans le même espace. Un moyen simple de les distinguer est de le préciser dans le nom du logement. Pour une séparation stricte, il faut deux comptes distincts, chacun avec son propre abonnement.",
  },
  {
    question: "Combien de logements pour une SCI ?",
    answer: `Cela dépend du plan choisi : ${propertiesLabel(STARTER)} avec ${STARTER.name}, ${propertiesLabel(PRO)} avec ${PRO.name}, ${propertiesLabel(BUSINESS)} avec ${BUSINESS.name}. Au-delà, écrivez-nous pour en discuter avant de souscrire.`,
  },
  {
    question: "Les documents de la société peuvent-ils être stockés ?",
    answer:
      "La bibliothèque documentaire est organisée par logement : baux, états des lieux, assurances, diagnostics, factures et garanties. Il n'existe pas d'espace documentaire propre à la société pour les statuts, procès-verbaux d'assemblée ou registres — ces pièces relèvent des obligations juridiques de la SCI et ne sont pas gérées par Nireo.",
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
      className="text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
    >
      {children}
    </Link>
  );
}

export default function GestionLocativeSciPage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide"
          h1="Gestion locative pour SCI : centraliser les biens et les documents"
          lead="Une SCI multiplie les pièces à conserver et les chiffres à tenir à jour. Nireo centralise les biens, les locataires, les baux, les loyers, les dépenses et les justificatifs de la société. Ce guide dit aussi, sans ambiguïté, ce qu'il ne prend pas en charge."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="perimetre" title="Le périmètre, dit d'emblée">
          <p>
            Une SCI a deux natures de charges administratives. La{" "}
            <strong className="text-foreground">gestion locative</strong> :
            suivre les biens loués, les locataires, les loyers, les dépenses,
            les documents. Et les{" "}
            <strong className="text-foreground">obligations de société</strong>{" "}
            : tenue de la comptabilité, assemblées, statuts, déclarations
            fiscales.
          </p>
          <p>
            Nireo intervient uniquement sur la première. C&apos;est un{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>
            , pas un logiciel de comptabilité de société.
          </p>
          <ContentNotice title="Ce que Nireo ne fait pas pour une SCI">
            <ContentList
              items={[
                "aucune comptabilité au sens légal : ni journal, ni grand livre, ni balance, ni bilan, ni compte de résultat ;",
                "aucune déclaration fiscale, aucun calcul d'impôt, aucune télétransmission ;",
                "aucune gestion des obligations juridiques : statuts, assemblées générales, procès-verbaux, registres, parts sociales ;",
                "aucun suivi des comptes courants d'associés ni de la répartition entre associés ;",
                "aucun conseil juridique ou fiscal.",
              ]}
            />
            <p>
              Ces sujets restent ceux du gérant et de son expert-comptable.
              Nireo leur fournit des chiffres à jour et des justificatifs
              retrouvables — c&apos;est déjà l&apos;essentiel du travail de
              préparation.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection id="ce-que-nireo-centralise" title="Ce que Nireo centralise pour une SCI">
          <ContentSubtitle>Les biens de la société</ContentSubtitle>
          <p>
            Chaque logement est décrit avec son adresse, son type, sa surface,
            son prix et sa date d&apos;acquisition, son loyer et sa provision
            sur charges, et son statut (loué, vacant, en travaux). Le patrimoine
            se lit d&apos;un coup d&apos;œil, sans ouvrir un dossier par bien.
          </p>

          <ContentSubtitle>Les locataires et les baux</ContentSubtitle>
          <p>
            Coordonnées, logement occupé, loyer, provision sur charges, dépôt de
            garantie, dates d&apos;entrée et de sortie. Un locataire sorti reste
            dans l&apos;historique du logement : la continuité d&apos;occupation
            d&apos;un bien détenu depuis longtemps reste lisible.
          </p>

          <ContentSubtitle>Les loyers</ContentSubtitle>
          <p>
            Les échéances des baux actifs sont générées automatiquement chaque
            mois, avec les statuts payé, en attente, en retard ou partiel selon
            le montant encaissé. C&apos;est ce registre qui alimente le total
            des revenus locatifs de la société. Le détail figure dans le guide{" "}
            <Inline href="/suivi-loyers">suivi des loyers</Inline>.
          </p>

          <ContentSubtitle>Les dépenses et les justificatifs</ContentSubtitle>
          <p>
            Chaque dépense porte un montant, une date, un fournisseur, une
            catégorie (travaux, assurance, taxe foncière, copropriété, autres)
            et son justificatif. C&apos;est précisément ce qu&apos;un comptable
            demande en fin d&apos;exercice, et ce qui se perd le plus vite
            quand la société détient plusieurs biens.
          </p>

          <ContentSubtitle>Les travaux</ContentSubtitle>
          <p>
            Chantier par logement : entreprise, budget prévu, coût réel, dates,
            avancement, photos avant/après et facture rattachée. La dépense
            correspondante est créée avec le chantier — pas de double saisie, et
            surtout pas de facture de travaux orpheline.
          </p>

          <ContentSubtitle>Les documents</ContentSubtitle>
          <p>
            Baux, états des lieux, attestations d&apos;assurance, diagnostics,
            factures et garanties, classés par logement et par catégorie, avec
            une date d&apos;expiration facultative pour les pièces qui en ont
            une. Les photos datées complètent le dossier de chaque bien.
          </p>
        </ContentSection>

        <ContentSection id="qui-fait-quoi" title="Qui fait quoi : Nireo, le gérant, le comptable">
          <ComparisonTable
            caption="Répartition des tâches entre Nireo et les obligations propres à la SCI"
            leftLabel="Pris en charge par Nireo"
            rightLabel="Reste au gérant / au comptable"
            rows={[
              {
                criterion: "Suivi des loyers",
                left: "Échéances générées, encaissements enregistrés, statuts calculés, historique conservé.",
                right: "Encaissement réel sur le compte bancaire de la société.",
              },
              {
                criterion: "Dépenses",
                left: "Saisie par catégorie, justificatif attaché, rattachement au bien.",
                right: "Qualification comptable et fiscale de chaque charge.",
              },
              {
                criterion: "Documents",
                left: "Bibliothèque par logement, avec dates d'expiration.",
                right: "Statuts, procès-verbaux, registres et pièces sociales.",
              },
              {
                criterion: "Chiffres",
                left: "Revenus, dépenses, résultat net, rendement brut, taux d'occupation.",
                right: "Comptes annuels, résultat fiscal, répartition entre associés.",
              },
              {
                criterion: "Déclarations",
                left: "Rien.",
                right: "Intégralité des déclarations et obligations fiscales.",
              },
              {
                criterion: "Accès",
                left: "Un compte propriétaire, données isolées, hébergement en Europe.",
                right: "Organisation interne de la société et transmission au comptable.",
              },
            ]}
          />
        </ContentSection>

        <ContentSection id="mise-en-place" title="Mettre en place l'espace de la SCI">
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Un compte tenu par la
                personne qui gère.</strong> Les données sont rattachées à un
                compte unique ; il n&apos;existe ni comptes multiples sur un
                même patrimoine, ni rôles. En pratique, c&apos;est le gérant qui
                tient l&apos;espace.
              </>,
              <>
                <strong className="text-foreground">Un import pour démarrer.</strong>{" "}
                Un modèle CSV téléchargeable depuis l&apos;application permet
                de créer les logements en une fois plutôt qu&apos;un par un.
              </>,
              <>
                <strong className="text-foreground">Une convention de
                nommage.</strong> Si vous détenez aussi des biens en direct,
                indiquez la société dans le nom du logement : le modèle de
                données ne connaît pas la notion de société.
              </>,
              <>
                <strong className="text-foreground">Un plan dimensionné au
                parc.</strong> {STARTER.name} pour {propertiesLabel(STARTER)},{" "}
                {PRO.name} pour {propertiesLabel(PRO)}, {BUSINESS.name} pour{" "}
                {propertiesLabel(BUSINESS)} — détail sur la{" "}
                <Inline href="/tarifs">page Tarifs</Inline>.
              </>,
              <>
                <strong className="text-foreground">Un export régulier.</strong>{" "}
                À partir du plan {STARTER.name}, l&apos;export JSON complet et
                l&apos;export CSV des loyers permettent de transmettre les
                données au comptable ou d&apos;en garder une copie.
              </>,
            ]}
          />
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title="Centralisez le patrimoine de votre SCI"
          description="Créez un compte gratuitement, ajoutez un premier bien et voyez si l'organisation vous convient avant de dimensionner votre plan."
          secondaryLabel="Poser une question"
          secondaryHref="/contact"
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
