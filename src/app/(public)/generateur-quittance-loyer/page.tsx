import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ContentColumn,
  ContentHeader,
  ContentList,
  ContentNotice,
  ContentPageShell,
  ContentSection,
} from "@/components/seo/content";
import { FaqSection } from "@/components/marketing/faq-section";
import { QuittanceGenerator } from "@/components/quittance/quittance-generator";
import { PILLAR_PAGE, QUITTANCE_TOOL, RESOURCES_PAGE, getGuide } from "@/config/seo-pages";
import { todayIso } from "@/lib/quittance/document";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  ORGANIZATION_ID,
  webPageJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * /generateur-quittance-loyer — outil public et gratuit.
 *
 * La page est STATIQUE : elle ne lit ni cookie, ni session, ni base. Tout le
 * travail (calcul, aperçu, PDF) a lieu dans le navigateur du visiteur, et
 * aucune information saisie n'est transmise à Nireo.
 *
 * L'accès est ouvert : le proxy laisse passer l'URL parce qu'elle figure dans
 * `CONTENT_PAGES` (src/config/seo-pages.ts), la même source que le sitemap et
 * le maillage interne.
 */

export const metadata: Metadata = {
  title: { absolute: "Générateur de quittance de loyer gratuit | Nireo" },
  description:
    "Créez gratuitement votre quittance de loyer en PDF. Renseignez le loyer, les charges et le locataire, puis téléchargez votre document.",
  alternates: { canonical: QUITTANCE_TOOL.path },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: QUITTANCE_TOOL.path,
    title: "Générateur de quittance de loyer gratuit | Nireo",
    description:
      "Créez gratuitement votre quittance de loyer en PDF. Renseignez le loyer, les charges et le locataire, puis téléchargez votre document.",
  },
};

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: RESOURCES_PAGE.shortTitle, path: RESOURCES_PAGE.path },
  { name: QUITTANCE_TOOL.shortTitle, path: QUITTANCE_TOOL.path },
];

const PAGE_URL = `${SITE_URL}${QUITTANCE_TOOL.path}`;

/**
 * FAQ affichée ET balisée : chaque question ci-dessous est visible dans le
 * HTML de la page, condition posée par Google pour émettre un FAQPage.
 */
const FAQ = [
  {
    question: "La quittance de loyer est-elle obligatoire ?",
    answer:
      "Le bailleur doit la remettre gratuitement au locataire qui la demande, dès lors que le loyer et les charges ont été intégralement payés. Il ne peut pas la facturer ni la conditionner à autre chose.",
  },
  {
    question: "Que faire si le locataire n’a payé qu’une partie du loyer ?",
    answer:
      "Une quittance ne peut pas être établie tant que le paiement n’est pas complet : elle vaudrait reconnaissance du paiement intégral. Le générateur produit alors un reçu de paiement partiel, qui mentionne la somme reçue et le solde restant dû.",
  },
  {
    question: "Mes informations sont-elles enregistrées quelque part ?",
    answer:
      "Non. Le document est fabriqué directement dans votre navigateur : aucune des informations saisies n’est envoyée à Nireo, enregistrée dans une base ou conservée après la fermeture de la page. Fermer l’onglet efface tout.",
  },
  {
    question: "Faut-il créer un compte pour télécharger le PDF ?",
    answer:
      "Non. Le générateur est entièrement gratuit, sans inscription et sans carte bancaire. Le compte Nireo sert à gérer vos loyers dans la durée, pas à obtenir ce document.",
  },
  {
    question: "Quelle différence entre le loyer et les charges sur la quittance ?",
    answer:
      "La loi impose de distinguer les deux montants. Le loyer rémunère la mise à disposition du logement ; les charges sont les provisions récupérables sur le locataire, régularisées une fois par an. Le générateur affiche les deux lignes séparément, puis le total.",
  },
];

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  webPageJsonLd({
    name: "Générateur de quittance de loyer gratuit",
    description: QUITTANCE_TOOL.description,
    path: QUITTANCE_TOOL.path,
    dateModified: QUITTANCE_TOOL.updatedAt,
  }),
  {
    "@type": "WebApplication",
    "@id": `${PAGE_URL}#application`,
    name: "Générateur de quittance de loyer Nireo",
    url: PAGE_URL,
    applicationCategory: "BusinessApplication",
    // L'outil tourne intégralement dans le navigateur : c'est vérifiable.
    operatingSystem: "Web (navigateur)",
    inLanguage: "fr-FR",
    browserRequirements: "Navigateur récent avec JavaScript activé",
    publisher: { "@id": ORGANIZATION_ID },
    description: QUITTANCE_TOOL.description,
    featureList: [
      "Quittance de loyer au format PDF A4",
      "Reçu de paiement partiel lorsque le règlement est incomplet",
      "Loyer et charges distingués, total calculé automatiquement",
      "Génération dans le navigateur, sans envoi de données",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  },
  faqPageJsonLd(FAQ, PAGE_URL),
  breadcrumbJsonLd(CRUMBS),
]);

/**
 * Page statique régénérée chaque heure : la seule donnée qui vieillit est la
 * date proposée par défaut dans le formulaire. Le visiteur peut la changer,
 * une heure de décalage après minuit est donc sans conséquence — et la page
 * reste servie depuis le cache, sans rendu serveur à chaque visite.
 */
export const revalidate = 3600;

export default function GenerateurQuittancePage() {
  const suiviLoyers = getGuide("/suivi-loyers");
  const today = todayIso();

  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        {/* Même en-tête que toutes les autres pages de contenu : le surtitre
            à filet cobalt remplace la pastille, et le halo « nireo-aurora »
            hérité de l'univers obsidienne disparaît avec lui. */}
        <ContentHeader
          eyebrow="Outil gratuit"
          h1="Générateur de quittance de loyer"
          lead="Remplissez le formulaire, vérifiez l’aperçu, téléchargez votre PDF. Gratuit, sans inscription et sans carte bancaire — le document est fabriqué dans votre navigateur, aucune information saisie n’est envoyée à Nireo."
          updatedAt={QUITTANCE_TOOL.updatedAt}
        />
     </ContentColumn>

      <ContentColumn>
        <QuittanceGenerator today={today} />
      </ContentColumn>

      <ContentColumn className="space-y-12">
        <ContentSection id="comment-ca-marche" title="Ce que contient le document">
          <p>
            Une quittance de loyer atteste que le locataire a payé l’intégralité du loyer et des
            charges d’une période. Elle est remise gratuitement par le bailleur, à la demande du
            locataire, une fois le paiement reçu.
          </p>
          <ContentList
            items={[
              <>
                <strong className="font-medium text-foreground">L’identité des parties</strong> :
                nom ou raison sociale du bailleur avec son adresse, nom du ou des locataires.
              </>,
              <>
                <strong className="font-medium text-foreground">Le logement</strong> et la{" "}
                <strong className="font-medium text-foreground">période</strong> couverte, du
                premier au dernier jour du mois.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Le loyer et les charges, séparément
                </strong>{" "}
                — la distinction est imposée par la loi — puis le total dû et la somme reçue.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  La date du paiement, le lieu et la date d’établissement
                </strong>
                , et l’emplacement de la signature du bailleur.
              </>,
            ]}
          />
        </ContentSection>

        <ContentSection id="paiement-partiel" title="Paiement partiel : un reçu, pas une quittance">
          <p>
            Si le locataire n’a réglé qu’une partie de ce qu’il devait, une quittance ne peut pas
            être établie : elle vaudrait reconnaissance d’un paiement intégral et se retournerait
            contre le bailleur. Le générateur applique la règle automatiquement.
          </p>
          <p>
            Dès que la somme payée est inférieure au total dû, le document change de nature : il
            devient un <strong className="font-medium text-foreground">reçu de paiement partiel</strong>,
            indique la somme réellement reçue, précise qu’il ne vaut pas quittance et fait
            apparaître le solde restant dû. Les montants négatifs et un paiement supérieur au
            total dû sont refusés.
          </p>
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          {/* Même accordéon que le reste de la vitrine : accessible sans
              JavaScript, et identique visuellement à la FAQ de la landing. */}
          <FaqSection items={FAQ} />
        </ContentSection>

        <ContentNotice title="Ce générateur n’est pas un service officiel">
          <p>
            Nireo met à disposition un modèle générique. Ce n’est ni un acte authentique, ni un
            conseil juridique, et aucune garantie n’est donnée sur la conformité du document à
            votre situation particulière — bail meublé, colocation, société, régularisation de
            charges, indivision. Relisez les informations avant de signer, et rapprochez-vous d’un
            professionnel en cas de doute ou de litige.
          </p>
        </ContentNotice>

        <ContentSection id="aller-plus-loin" title="Aller plus loin">
          <p>
            Une quittance par mois et par logement, cela finit par faire beaucoup de fichiers à
            retrouver. Si vous gérez plusieurs biens, lisez notre guide sur le{" "}
            <Link
              href={suiviLoyers.path}
              className="nl-focus font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
            >
              suivi des loyers
            </Link>{" "}
            ou la page de référence sur le{" "}
            <Link
              href={PILLAR_PAGE.path}
              className="nl-focus font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
            >
              logiciel de gestion locative
            </Link>
            .
          </p>
        </ContentSection>
      </ContentColumn>
    </ContentPageShell>
  );
}
