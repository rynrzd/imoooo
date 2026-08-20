import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
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

const PAGE = getGuide("/gestion-locative-proprietaire-bailleur");
const FREE = getPlan("free");
const STARTER = getPlan("starter");
const PRO = getPlan("pro");

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
    question: "Qu'est-ce que l'autogestion locative ?",
    answer:
      "C'est le fait de gérer soi-même ses locations plutôt que de les confier à une agence : trouver le locataire, établir le bail, suivre les encaissements, conserver les documents, organiser l'entretien. Vous conservez la relation directe avec le locataire et la totalité du loyer, en échange du temps que cela demande.",
  },
  {
    question: "Nireo envoie-t-il les relances de loyer à ma place ?",
    answer: `Cela dépend du plan. À partir du plan ${STARTER.name}, vous déclenchez une relance par e-mail depuis l'échéance concernée. À partir du plan ${PRO.name}, les relances peuvent être envoyées automatiquement, avec un message que vous personnalisez. Sur le plan ${FREE.name}, aucune relance n'est envoyée par Nireo.`,
  },
  {
    question: "Nireo génère-t-il mes quittances de loyer ?",
    answer:
      "Non. Nireo enregistre les encaissements, leur date et leur statut, et conserve l'historique par logement, mais ne produit pas de document de quittance. Vous pouvez en revanche déposer dans la bibliothèque documentaire du logement les quittances que vous établissez.",
  },
  {
    question: "Nireo rédige-t-il mes baux ?",
    answer:
      "Non. Nireo enregistre les caractéristiques du bail (loyer, provision sur charges, dépôt de garantie, dates d'entrée et de sortie) et vous permet de stocker le contrat signé, mais il ne rédige aucun document contractuel et ne fournit aucun modèle de bail.",
  },
  {
    question: "Combien de temps faut-il pour mettre en place son suivi ?",
    answer:
      "Compter quelques minutes par logement : créer le bien, ajouter le locataire et son bail, déposer les documents importants. Les échéances de loyer des mois suivants se créent ensuite automatiquement, sans nouvelle saisie.",
  },
  {
    question: "Puis-je gérer des biens détenus par plusieurs personnes ?",
    answer:
      "Les données de Nireo sont rattachées à un compte propriétaire, qui est le seul à y accéder. Il n'existe pas aujourd'hui de partage d'un même patrimoine entre plusieurs comptes utilisateurs, ni de gestion de rôles ou de permissions.",
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

export default function ProprietaireBailleurPage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide"
          h1="Gestion locative pour propriétaire bailleur : s'organiser en autogestion"
          lead="Gérer soi-même ses locations n'a rien de compliqué : c'est surtout une question de régularité et de mémoire. Voici la routine d'un bailleur en autogestion et, à chaque étape, ce que Nireo prend en charge — et ce qu'il ne prend pas en charge."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="autogestion" title="Autogestion : ce que cela veut dire concrètement">
          <p>
            Un propriétaire bailleur en autogestion assume lui-même les
            fonctions qu&apos;une agence facturerait : sélection du locataire,
            signature du bail, état des lieux, suivi des encaissements,
            conservation des documents, organisation de l&apos;entretien et des
            travaux, et enfin restitution du dépôt de garantie en fin de bail.
          </p>
          <p>
            Ce n&apos;est pas un travail lourd, mais c&apos;est un travail
            <em> continu</em>. La difficulté réelle n&apos;est presque jamais
            technique : c&apos;est de se souvenir, plusieurs années de suite, de
            ce qui a été fait, payé, signé et promis. C&apos;est exactement ce
            qu&apos;un{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>{" "}
            prend en charge.
          </p>
        </ContentSection>

        <ContentSection id="mise-en-place" title="La mise en place, une fois pour toutes">
          <StepList
            steps={[
              {
                title: "Décrire le bien",
                description:
                  "Adresse, type, surface, nombre de pièces, prix et date d'acquisition, loyer hors charges et provision sur charges. Ces informations servent ensuite au calcul du rendement.",
              },
              {
                title: "Enregistrer le bail en cours",
                description:
                  "Locataire, loyer, charges, dépôt de garantie, date d'entrée. C'est ce qui déclenche la génération automatique des échéances mensuelles.",
              },
              {
                title: "Déposer les pièces clés",
                description:
                  "Bail signé, état des lieux d'entrée, attestation d'assurance, diagnostics. Une date d'expiration peut être posée sur les documents qui en ont une.",
              },
            ]}
          />
          <p>
            Cette mise en place se fait une fois par logement. Tout le reste se
            joue ensuite au fil de l&apos;eau.
          </p>
        </ContentSection>

        <ContentSection id="routine-mensuelle" title="La routine mensuelle">
          <ContentSubtitle>Vérifier les encaissements</ContentSubtitle>
          <p>
            Les échéances du mois sont déjà créées à partir des baux actifs.
            Vous n&apos;avez qu&apos;à constater : lorsqu&apos;un virement
            arrive, vous enregistrez le montant reçu et sa date. Le statut se
            met à jour tout seul en payé, partiel, en attente ou en retard selon
            l&apos;écart avec le montant attendu.
          </p>

          <ContentSubtitle>Traiter les retards</ContentSubtitle>
          <p>
            Un loyer en retard remonte dans le tableau de bord. Selon votre
            plan, vous envoyez une relance par e-mail depuis l&apos;échéance
            concernée ({STARTER.name} et au-delà), ou vous laissez Nireo
            l&apos;envoyer automatiquement avec votre propre message ({PRO.name}{" "}
            et au-delà).
          </p>

          <ContentSubtitle>Saisir les dépenses du mois</ContentSubtitle>
          <p>
            Assurance, taxe foncière, charges de copropriété, petites
            réparations : chaque dépense est rattachée à un logement, classée
            par catégorie, avec le justificatif attaché. C&apos;est ce qui rend
            le résultat net crédible en fin d&apos;année.
          </p>
        </ContentSection>

        <ContentSection id="au-fil-de-l-annee" title="Au fil de l'année">
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Les documents qui
                expirent.</strong> Une assurance ou un diagnostic dont la date
                d&apos;expiration approche remonte dans le tableau de bord —
                sans qu&apos;il faille y penser.
              </>,
              <>
                <strong className="text-foreground">Les travaux.</strong> Un
                chantier se suit avec son entreprise, son budget prévu, son
                coût réel, ses dates et son avancement. Les photos avant/après
                et la facture y sont rattachées, et la dépense correspondante
                est créée en regard.
              </>,
              <>
                <strong className="text-foreground">Les changements de
                locataire.</strong> La date de sortie clôt le bail ; le
                locataire reste dans l&apos;historique du logement, avec ses
                encaissements. Le logement passe en vacant, puis en loué avec le
                bail suivant.
              </>,
              <>
                <strong className="text-foreground">Le bilan.</strong> Revenus
                encaissés, dépenses engagées, résultat net, rendement brut et
                taux d&apos;occupation sont calculés en continu à partir de vos
                données — jamais ressaisis.
              </>,
            ]}
          />
        </ContentSection>

        <ContentSection id="ce-qui-reste-a-votre-charge" title="Ce qui reste entièrement à votre charge">
          <p>
            Un outil de suivi ne remplace ni un professionnel du droit, ni un
            comptable, ni vous-même.
          </p>
          <ContentNotice title="Nireo ne fait pas">
            <ContentList
              items={[
                "rédiger vos baux, vos états des lieux ou vos congés — Nireo enregistre leurs informations et stocke les documents signés ;",
                "produire vos quittances de loyer ;",
                "encaisser les loyers ni gérer les virements — Nireo enregistre ce que vous avez reçu ;",
                "tenir votre comptabilité au sens légal, établir un bilan ou remplir une déclaration fiscale ;",
                "vous conseiller sur la réglementation applicable à votre location.",
              ]}
            />
          </ContentNotice>
          <p>
            Ce partage est volontaire : Nireo est un outil d&apos;organisation,
            pas un mandataire. Ce qui reste à votre charge le serait de toute
            façon en autogestion.
          </p>
        </ContentSection>

        <ContentSection id="quel-plan" title="Quel plan pour quelle situation">
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Un logement loué :</strong>{" "}
                le plan {FREE.name} ({propertiesLabel(FREE)}) suffit
                durablement, sans carte bancaire. Voir le guide{" "}
                <Inline href="/logiciel-gestion-locative-gratuit">
                  logiciel de gestion locative gratuit
                </Inline>
                .
              </>,
              <>
                <strong className="text-foreground">
                  Deux à {STARTER.limits.maxProperties} logements :
                </strong>{" "}
                le plan {STARTER.name} ({propertiesLabel(STARTER)}) ajoute les
                relances par e-mail et les exports.
              </>,
              <>
                <strong className="text-foreground">
                  Jusqu&apos;à {PRO.limits.maxProperties} logements :
                </strong>{" "}
                le plan {PRO.name} ajoute les relances automatiques, le rapport
                mensuel par e-mail, les statistiques avancées et
                l&apos;historique complet.
              </>,
              <>
                <strong className="text-foreground">
                  Patrimoine établi ou détenu en société :
                </strong>{" "}
                voir la <Inline href="/tarifs">page Tarifs</Inline> et, pour une
                SCI, le guide{" "}
                <Inline href="/gestion-locative-sci">gestion locative SCI</Inline>
                .
              </>,
            ]}
          />
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title="Mettez votre suivi en place ce mois-ci"
          description="Créez votre compte, décrivez un logement et son bail : les échéances des mois suivants se génèrent ensuite toutes seules."
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
