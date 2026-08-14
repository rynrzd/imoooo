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

const PAGE = getGuide("/gestion-immobiliere");

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
    question: "Quelle différence entre gestion immobilière et gestion locative ?",
    answer:
      "La gestion immobilière est le terme le plus large : elle peut englober l'acquisition, l'entretien, le financement, l'administration et la location d'un patrimoine. La gestion locative concerne plus précisément la relation bailleur-locataire et le suivi quotidien des locations.",
  },
  {
    question: "Un propriétaire peut-il assurer lui-même sa gestion immobilière ?",
    answer:
      "Oui. Un propriétaire peut gérer directement ses locations s'il dispose du temps, des connaissances nécessaires et d'une organisation fiable. Il reste responsable de ses obligations et peut confier tout ou partie des tâches à un professionnel.",
  },
  {
    question: "Un logiciel de gestion locative remplace-t-il une agence ?",
    answer:
      "Non. Un logiciel organise les données et automatise certaines tâches, mais il n'agit pas à la place du bailleur. Nireo ne recherche pas de locataire, ne signe pas de bail, ne réalise pas d'état des lieux et n'encaisse pas les loyers pour le propriétaire.",
  },
  {
    question: "Nireo réalise-t-il la comptabilité ou la déclaration fiscale ?",
    answer:
      "Non. Nireo centralise revenus, dépenses et justificatifs et calcule des indicateurs de suivi. Il ne tient pas de comptabilité légale, n'établit pas de bilan et ne produit aucune déclaration fiscale.",
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

export default function GestionImmobilierePage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide"
          h1="Gestion immobilière : ce que cela couvre vraiment"
          lead="La gestion immobilière ne se limite pas à vérifier un loyer. Elle réunit les décisions, les obligations et les opérations nécessaires pour conserver, louer et suivre un patrimoine. Voici son périmètre — et la partie qu'un logiciel peut réellement simplifier."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="definition" title="Définition de la gestion immobilière">
          <p>
            La gestion immobilière désigne l&apos;ensemble des actions menées
            pour administrer un ou plusieurs biens dans la durée. Selon le
            patrimoine, elle peut commencer avant la mise en location — achat,
            financement ou travaux — et continuer avec la gestion des occupants,
            des loyers, des charges, des documents et de l&apos;entretien.
          </p>
          <p>
            Dans le langage courant, l&apos;expression est parfois utilisée
            comme synonyme de gestion locative. Cette dernière en est pourtant
            une composante plus précise : elle organise la location et la
            relation entre le propriétaire bailleur et le locataire.
          </p>
        </ContentSection>

        <ContentSection id="missions" title="Les principales missions de gestion immobilière">
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Administrer le bien :</strong>{" "}
                conserver les titres, contrats, diagnostics, assurances et
                justificatifs utiles.
              </>,
              <>
                <strong className="text-foreground">Organiser la location :</strong>{" "}
                définir les conditions, sélectionner un locataire, établir les
                documents et suivre les dates du bail.
              </>,
              <>
                <strong className="text-foreground">Suivre les flux :</strong>{" "}
                rapprocher loyers attendus et encaissements, enregistrer les
                charges, les dépenses et les dépôts de garantie.
              </>,
              <>
                <strong className="text-foreground">Entretenir le patrimoine :</strong>{" "}
                planifier les interventions, suivre les travaux, leurs factures
                et l&apos;historique technique de chaque logement.
              </>,
              <>
                <strong className="text-foreground">Piloter dans la durée :</strong>{" "}
                observer revenus, dépenses, résultat et occupation afin de
                décider avec des données cohérentes.
              </>,
            ]}
          />
          <ContentNotice title="Le périmètre juridique et fiscal dépend de chaque situation">
            <p>
              Les règles varient selon le type de location, le bail, le régime
              fiscal et la structure de détention. Un outil de suivi ne remplace
              ni les textes applicables ni le conseil d&apos;un professionnel
              lorsqu&apos;une situation exige une expertise juridique, comptable
              ou fiscale.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection
          id="gestion-immobiliere-vs-locative"
          title="Gestion immobilière et gestion locative : la différence"
        >
          <ComparisonTable
            caption="Différences entre gestion immobilière et gestion locative"
            leftLabel="Gestion immobilière"
            rightLabel="Gestion locative"
            rows={[
              {
                criterion: "Périmètre",
                left: "Le patrimoine immobilier dans son ensemble.",
                right: "Les biens loués et la relation avec leurs occupants.",
              },
              {
                criterion: "Horizon",
                left: "De l'acquisition à la conservation ou la cession.",
                right: "De la préparation de la location à la fin du bail.",
              },
              {
                criterion: "Opérations courantes",
                left: "Financement, assurance, entretien, travaux et pilotage du patrimoine.",
                right: "Bail, échéances, loyers, charges, documents et suivi du locataire.",
              },
              {
                criterion: "Intervenants possibles",
                left: "Propriétaire, gestionnaire, syndic, artisans, assureur ou comptable.",
                right: "Propriétaire bailleur, administrateur de biens et locataire.",
              },
              {
                criterion: "Outil adapté",
                left: "Un ensemble d'outils selon les dimensions patrimoniale, technique et financière.",
                right: "Un logiciel de gestion locative pour centraliser le suivi quotidien.",
              },
            ]}
          />
        </ContentSection>

        <ContentSection id="modes-gestion" title="Gérer soi-même ou déléguer">
          <p>
            Il n&apos;existe pas un mode de gestion adapté à tous les
            propriétaires. Le choix dépend du temps disponible, de la distance,
            de la complexité des locations et du niveau d&apos;accompagnement
            recherché.
          </p>
          <ContentSubtitle>La gestion déléguée</ContentSubtitle>
          <p>
            Une agence ou un administrateur de biens exécute les missions
            prévues au mandat et facture cette intervention. Cette solution
            convient au propriétaire qui veut confier l&apos;opérationnel ou qui
            ne peut pas intervenir facilement.
          </p>
          <ContentSubtitle>L&apos;autogestion</ContentSubtitle>
          <p>
            Le propriétaire conserve les décisions et réalise lui-même les
            tâches. Il évite des honoraires de gestion, mais doit tenir un suivi
            régulier et maîtriser ses obligations. Le guide dédié à la{" "}
            <Inline href="/gestion-locative-proprietaire-bailleur">
              gestion locative du propriétaire bailleur
            </Inline>{" "}
            détaille cette organisation mois par mois.
          </p>
          <ContentSubtitle>La formule hybride</ContentSubtitle>
          <p>
            Le bailleur peut aussi garder le suivi courant et faire appel à un
            professionnel pour une mission ponctuelle : rédaction, état des
            lieux, contentieux, comptabilité ou fiscalité.
          </p>
        </ContentSection>

        <ContentSection id="logiciel" title="Ce qu'un logiciel apporte à l'autogestion">
          <p>
            Un{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>{" "}
            ne prend aucune décision à la place du propriétaire. Son rôle est
            de relier les informations qui seraient autrement dispersées dans
            un tableur, des dossiers et des messages.
          </p>
          <StepList
            steps={[
              {
                title: "Centraliser",
                description:
                  "Rassembler le logement, son locataire, son bail, ses documents, ses dépenses et ses travaux.",
              },
              {
                title: "Suivre",
                description:
                  "Créer les échéances attendues, enregistrer les encaissements et repérer les retards ou paiements partiels.",
              },
              {
                title: "Conserver",
                description:
                  "Garder un historique exploitable par bien au lieu de reconstruire l'information à la fin de l'année.",
              },
            ]}
          />
        </ContentSection>

        <ContentSection id="nireo" title="La place de Nireo dans la gestion immobilière">
          <p>
            Nireo couvre la partie locative de la gestion immobilière pour les
            bailleurs en autogestion. L&apos;application réunit logements,
            locataires, baux, échéances, encaissements, documents, photos,
            dépenses, travaux et indicateurs dans un espace web unique.
          </p>
          <ContentList
            items={[
              "les échéances sont générées depuis les baux actifs ;",
              "les statuts payé, en attente, en retard ou partiel sont calculés à partir des encaissements ;",
              "les documents et photos restent rattachés au logement concerné ;",
              "les dépenses, travaux et justificatifs sont conservés avec leur historique ;",
              "les revenus, dépenses, résultat net et indicateurs sont recalculés à partir des données saisies.",
            ]}
          />
          <ContentNotice title="Ce que Nireo ne fait pas">
            <p>
              Nireo n&apos;est ni une agence, ni un syndic, ni un cabinet
              comptable. Il ne recherche pas de locataires, ne rédige pas les
              baux, ne réalise pas les états des lieux, n&apos;encaisse pas les
              loyers et ne produit pas de déclaration fiscale.
            </p>
          </ContentNotice>
          <p>
            Pour une SCI, consultez aussi le guide sur la{" "}
            <Inline href="/gestion-locative-sci">gestion locative en SCI</Inline>.
          </p>
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title="Organisez la partie locative de votre patrimoine"
          description="Commencez par un logement avec le plan Gratuit de Nireo, sans carte bancaire, puis vérifiez si l'organisation correspond à votre façon de gérer."
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
