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
import { formatStorage, getPlan, propertiesLabel } from "@/config/plans";
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

const PAGE = getGuide("/alternative-excel-gestion-locative");
const FREE = getPlan("free");
const STARTER = getPlan("starter");

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
    question: "Excel suffit-il pour gérer une location ?",
    answer:
      "Pour un logement, un locataire stable et peu de documents, oui : un tableau de douze lignes par an fait le travail. Les limites apparaissent quand il faut relier les loyers aux dépenses, retrouver un diagnostic ou reconstituer l'historique d'un bien sur plusieurs années.",
  },
  {
    question: "Puis-je récupérer mon fichier Excel dans Nireo ?",
    answer:
      "Vous pouvez importer une liste de logements depuis un fichier au format CSV, à partir d'un modèle téléchargeable dans l'application. Les locataires, les baux et l'historique des loyers se saisissent ensuite dans l'interface : ils ne sont pas importés automatiquement.",
  },
  {
    question: "Est-ce que je perds mes données si j'arrête Nireo ?",
    answer: `Non. À partir du plan ${STARTER.name}, vous téléchargez à tout moment un export complet de vos données au format JSON et un export CSV de vos loyers depuis les paramètres. Quel que soit votre plan, vous pouvez demander la récupération de vos données au support avant de supprimer votre compte.`,
  },
  {
    question: "Nireo remplace-t-il aussi mon logiciel de comptabilité ?",
    answer:
      "Non. Nireo suit vos revenus locatifs, vos dépenses et vos justificatifs, mais ne tient pas de comptabilité au sens légal et n'établit aucune déclaration fiscale. Il prépare les chiffres, il ne remplace pas un expert-comptable.",
  },
  {
    question: "Combien coûte le passage du tableur à Nireo ?",
    answer: `Rien pour commencer : le plan ${FREE.name} couvre ${propertiesLabel(FREE)} de façon permanente, sans carte bancaire. Au-delà, l'abonnement est un montant fixe par mois, indépendant du montant de vos loyers.`,
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

export default function AlternativeExcelPage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide"
          h1="Alternative à Excel pour gérer ses locations"
          lead="Le tableur est le premier outil de tout propriétaire bailleur, et souvent le bon. Ce guide explique où il cesse de l'être, ce qu'on perd sans s'en apercevoir, et ce qu'un logiciel dédié apporte à la place."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="quand-excel-suffit" title="Quand Excel suffit vraiment">
          <p>
            Il faut le dire clairement : pour beaucoup de situations, un tableur
            est parfaitement adapté. Si vous louez un logement à un locataire
            stable, que le loyer tombe le même jour chaque mois et que vos
            documents tiennent dans un dossier, douze lignes par an suffisent.
            Vous connaissez l&apos;outil, il ne coûte rien de plus, et il est
            entièrement sous votre contrôle.
          </p>
          <p>Le tableur reste pertinent tant que :</p>
          <ContentList
            items={[
              "le nombre de lignes à tenir à jour chaque mois reste inférieur à ce que vous pouvez vérifier d'un coup d'œil ;",
              "vous n'avez pas besoin de relier un document, une photo ou une facture à une ligne du tableau ;",
              "personne d'autre que vous n'a besoin de consulter le fichier ;",
              "vous n'avez pas besoin de retrouver l'historique d'un bien au-delà de l'année en cours.",
            ]}
          />
          <p>
            Si ces quatre points sont vrais, restez sur votre fichier. La suite
            de ce guide concerne le moment où ils cessent de l&apos;être.
          </p>
        </ContentSection>

        <ContentSection
          id="ou-le-tableur-atteint-ses-limites"
          title="Où le tableur atteint ses limites"
        >
          <p>
            Le déclencheur n&apos;est presque jamais le nombre de biens. C&apos;est
            le temps qui passe et la quantité de choses à relier entre elles.
          </p>

          <ContentSubtitle>La ressaisie mensuelle</ContentSubtitle>
          <p>
            Chaque mois, il faut créer une ligne par locataire, vérifier
            l&apos;arrivée du virement, mettre à jour un statut. C&apos;est
            court, mais c&apos;est répétitif, et une seule occurrence oubliée
            crée un trou dans le suivi qui ne se voit qu&apos;à la relecture
            annuelle — parfois bien après le délai utile pour relancer.
          </p>

          <ContentSubtitle>Les documents vivent ailleurs</ContentSubtitle>
          <p>
            Le tableur suit des montants. Il ne stocke ni le bail, ni
            l&apos;état des lieux, ni le diagnostic, ni la facture de la
            chaudière. Ces pièces finissent dans des dossiers, des boîtes mail
            et des galeries photo, sans lien avec la ligne qui les concerne.
            Le jour où un locataire conteste un point du bail, la recherche
            commence.
          </p>

          <ContentSubtitle>Les formules cassent en silence</ContentSubtitle>
          <p>
            Une ligne insérée au mauvais endroit, une plage qui ne suit pas, un
            copier-coller entre onglets : le total continue d&apos;afficher un
            nombre, simplement faux. Rien ne le signale. C&apos;est la
            différence la plus importante avec un logiciel où le résultat est
            recalculé à partir des données, jamais saisi.
          </p>

          <ContentSubtitle>L&apos;historique s&apos;évapore</ContentSubtitle>
          <p>
            « Combien ce logement m&apos;a-t-il coûté en travaux depuis
            l&apos;achat ? » suppose de rouvrir les fichiers des années
            précédentes, en espérant qu&apos;ils aient la même structure. En
            pratique, la question reste sans réponse.
          </p>

          <ContentSubtitle>Une seule copie, un seul appareil</ContentSubtitle>
          <p>
            Un fichier local dépend d&apos;une machine et d&apos;une sauvegarde
            que personne ne vérifie. Un fichier partagé en ligne règle ce point,
            mais pas les précédents.
          </p>
        </ContentSection>

        <ContentSection id="ce-que-change-nireo" title="Ce que Nireo centralise à la place">
          <p>
            Nireo est un{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>{" "}
            : les données ne sont pas dans des colonnes indépendantes, elles
            sont reliées. Un logement porte son locataire, son bail, ses
            échéances, ses documents, ses photos, ses dépenses et ses chantiers.
          </p>
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Les échéances se créent
                seules.</strong> À partir des baux actifs, Nireo génère chaque
                mois l&apos;échéance attendue. Vous n&apos;ajoutez plus de
                ligne : vous constatez un encaissement.
              </>,
              <>
                <strong className="text-foreground">Le statut est
                déduit.</strong> Payé, en attente, en retard ou partiel découle
                du montant reçu comparé au montant attendu — pas d&apos;une
                couleur choisie à la main.
              </>,
              <>
                <strong className="text-foreground">Les documents sont
                rattachés au bien.</strong> Baux, états des lieux, assurances,
                diagnostics, factures et garanties, classés par catégorie, avec
                une date d&apos;expiration facultative.
              </>,
              <>
                <strong className="text-foreground">Les photos sont datées et
                classées</strong> par logement (avant location, entrée, sortie,
                dommages, après travaux).
              </>,
              <>
                <strong className="text-foreground">Travaux et dépenses ne
                font qu&apos;un.</strong> Un chantier enregistré crée la dépense
                correspondante, avec sa facture — sans double saisie.
              </>,
              <>
                <strong className="text-foreground">Les totaux sont
                calculés.</strong> Revenus, dépenses, résultat net, rendement
                brut et taux d&apos;occupation sont dérivés de vos données
                réelles, en continu.
              </>,
            ]}
          />
          <ContentNotice title="Ce que Nireo ne remplace pas">
            <p>
              Nireo ne tient pas de comptabilité légale, n&apos;établit aucun
              bilan et ne produit aucune déclaration fiscale. Il n&apos;est pas
              non plus une agence : il ne recherche pas de locataires, ne rédige
              pas vos baux et n&apos;encaisse aucun loyer à votre place.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection id="comparatif" title="Tableur ou logiciel : le comparatif">
          <ComparisonTable
            caption="Différences pratiques entre un tableur et Nireo"
            leftLabel="Tableur"
            rightLabel="Nireo"
            rows={[
              {
                criterion: "Créer le suivi du mois",
                left: "Une ligne à ajouter par locataire.",
                right: "Échéances générées automatiquement depuis les baux actifs.",
              },
              {
                criterion: "Savoir qui n'a pas payé",
                left: "Relecture visuelle du tableau.",
                right: "Statut « en retard » calculé à partir des montants reçus.",
              },
              {
                criterion: "Retrouver un bail",
                left: "Dans un dossier ou une boîte mail.",
                right: "Dans la fiche du logement, catégorie « bail ».",
              },
              {
                criterion: "Suivre une expiration (assurance, diagnostic)",
                left: "Un rappel à poser soi-même, s'il y pense.",
                right: "Date d'expiration portée par le document et remontée dans le tableau de bord.",
              },
              {
                criterion: "Relier une facture à un chantier",
                left: "Manuellement, si un onglet le prévoit.",
                right: "La facture et la dépense sont attachées au chantier.",
              },
              {
                criterion: "Calculer le résultat net d'un bien",
                left: "Formules à écrire et à maintenir.",
                right: "Recalculé à chaque écriture.",
              },
              {
                criterion: "Consulter depuis le téléphone",
                left: "Dépend de l'application et du format du fichier.",
                right: "Interface web responsive, sans installation.",
              },
              {
                criterion: "Sauvegarde",
                left: "À votre charge.",
                right: "Écriture immédiate en base, sans action de votre part.",
              },
              {
                criterion: "Reprendre la main sur ses données",
                left: "Le fichier vous appartient.",
                right: `Export JSON complet et export CSV des loyers à partir du plan ${STARTER.name}.`,
              },
            ]}
          />
        </ContentSection>

        <ContentSection id="comment-basculer" title="Comment basculer sans tout ressaisir">
          <p>
            La bascule se fait par étapes, en gardant le fichier existant comme
            filet le temps de la transition :
          </p>
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Importez vos
                logements.</strong> Un modèle CSV est téléchargeable depuis
                l&apos;application : vous y reportez adresse, type, surface,
                loyer et charges, puis vous l&apos;importez.
              </>,
              <>
                <strong className="text-foreground">Créez les baux en
                cours.</strong> Locataire, loyer, provision sur charges, dépôt
                de garantie, date d&apos;entrée. Les échéances des mois suivants
                se créent ensuite toutes seules.
              </>,
              <>
                <strong className="text-foreground">Déposez les documents
                importants d&apos;abord.</strong> Bail, état des lieux,
                assurance et diagnostics. Le reste peut être ajouté au fil de
                l&apos;eau.
              </>,
              <>
                <strong className="text-foreground">Reprenez l&apos;historique
                seulement s&apos;il vous sert.</strong> Beaucoup de propriétaires
                repartent de l&apos;année en cours et gardent l&apos;ancien
                fichier en archive : le rapport temps/bénéfice y est souvent
                plus favorable.
              </>,
            ]}
          />
          <p>
            Vous pouvez commencer avec le plan {FREE.name} :{" "}
            {propertiesLabel(FREE)}, {FREE.limits.maxDocuments} documents,{" "}
            {FREE.limits.maxPhotos} photos et{" "}
            {formatStorage(FREE.limits.storageMb)} de stockage, sans carte
            bancaire — de quoi tester la bascule sur un seul bien avant de
            décider. Les limites de chaque plan sont détaillées dans le guide{" "}
            <Inline href="/logiciel-gestion-locative-gratuit">
              logiciel de gestion locative gratuit
            </Inline>
            .
          </p>
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title="Testez la bascule sur un seul logement"
          description={`Le plan ${FREE.name} est permanent, sans carte bancaire : le moyen le plus simple de comparer avec votre fichier actuel.`}
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
