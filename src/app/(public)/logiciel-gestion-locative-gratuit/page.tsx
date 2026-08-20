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
import {
  formatLimit,
  formatPlanPrice,
  formatStorage,
  getPlan,
  propertiesLabel,
} from "@/config/plans";
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

const PAGE = getGuide("/logiciel-gestion-locative-gratuit");
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
    question: "Le plan Gratuit de Nireo est-il limité dans le temps ?",
    answer:
      "Non. Ce n'est pas un essai de 14 ou 30 jours : le plan Gratuit est permanent. Tant que vous restez dans ses limites, vous pouvez l'utiliser indéfiniment, sans carte bancaire.",
  },
  {
    question: "Faut-il une carte bancaire pour créer un compte ?",
    answer:
      "Non. La création de compte demande une adresse e-mail et un mot de passe, puis une confirmation de l'adresse. Aucun moyen de paiement n'est demandé pour utiliser le plan Gratuit.",
  },
  {
    question: "Combien de logements le plan Gratuit permet-il ?",
    answer: `${propertiesLabel(FREE).charAt(0).toUpperCase() + propertiesLabel(FREE).slice(1)} et ${FREE.limits.maxActiveTenants} locataire actif. Pour un deuxième logement, il faut passer au plan ${STARTER.name} (${propertiesLabel(STARTER)}).`,
  },
  {
    question: "Que se passe-t-il si j'atteins la limite ?",
    answer:
      "Rien ne disparaît. Vos données existantes restent accessibles et modifiables ; seul l'ajout d'un élément au-delà du quota est refusé, avec un message explicite. La limite est appliquée par le serveur, pas seulement par l'interface.",
  },
  {
    question: "Quelles fonctions sont absentes du plan Gratuit ?",
    answer: `Les relances de loyer par e-mail et les exports JSON et CSV commencent au plan ${STARTER.name}. Les statistiques avancées, le rapport mensuel par e-mail, les relances automatiques et l'historique complet commencent au plan ${PRO.name}. Le plan Gratuit conserve les modules essentiels : logements, locataires, baux, loyers, documents, photos, dépenses, travaux et statistiques de base.`,
  },
  {
    question: "Mes données sont-elles moins protégées sur le plan Gratuit ?",
    answer:
      "Non. L'isolation des données par compte, l'hébergement en Europe et le stockage privé des fichiers sont identiques sur tous les plans. Le plan ne change que les quotas et les fonctions, jamais le niveau de protection.",
  },
  {
    question: "Puis-je supprimer mon compte gratuitement ?",
    answer:
      "Oui, à tout moment depuis Paramètres → Compte, en confirmant avec votre mot de passe. La suppression est définitive et efface l'ensemble de vos données, conformément au RGPD.",
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

export default function LogicielGratuitPage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide"
          h1="Logiciel de gestion locative gratuit : ce que permet vraiment le plan Gratuit de Nireo"
          lead="« Gratuit » recouvre beaucoup de choses différentes : essai limité dans le temps, version bridée, offre financée par la publicité. Voici, sans détour, ce que couvre le plan Gratuit de Nireo, où il s'arrête, et à qui il suffit."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="reponse-directe" title="La réponse en trois phrases">
          <p>
            Le plan {FREE.name} de Nireo est <strong className="text-foreground">
            permanent</strong> : ce n&apos;est pas un essai qui expire. Il ne
            demande <strong className="text-foreground">aucune carte
            bancaire</strong> et couvre {propertiesLabel(FREE)} avec{" "}
            {FREE.limits.maxActiveTenants} locataire actif. Il donne accès aux
            modules de gestion essentiels ; les fonctions d&apos;automatisation
            et les gros volumes relèvent des plans payants.
          </p>
          <p>
            Il n&apos;est financé ni par la publicité, ni par la revente de
            données : c&apos;est une porte d&apos;entrée, assumée comme telle.
          </p>
        </ContentSection>

        <ContentSection id="limites-exactes" title="Les limites exactes, chiffre par chiffre">
          <p>
            Ces valeurs sont celles appliquées par l&apos;application. Elles
            sont contrôlées côté serveur et en base de données, pas seulement
            dans l&apos;interface.
          </p>
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Logements :</strong>{" "}
                {formatLimit(FREE.limits.maxProperties)}
              </>,
              <>
                <strong className="text-foreground">Locataires actifs
                simultanés :</strong> {formatLimit(FREE.limits.maxActiveTenants)}
              </>,
              <>
                <strong className="text-foreground">Documents :</strong>{" "}
                {formatLimit(FREE.limits.maxDocuments)}
              </>,
              <>
                <strong className="text-foreground">Photos :</strong>{" "}
                {formatLimit(FREE.limits.maxPhotos)}
              </>,
              <>
                <strong className="text-foreground">Stockage total
                (documents + photos) :</strong>{" "}
                {formatStorage(FREE.limits.storageMb)}
              </>,
              <>
                <strong className="text-foreground">Durée :</strong> illimitée
              </>,
              <>
                <strong className="text-foreground">Coût :</strong>{" "}
                {formatPlanPrice(FREE.monthlyPrice)} €
              </>,
            ]}
          />
          <ContentNotice title="Atteindre une limite ne fait rien perdre">
            <p>
              Si vous atteignez un quota, vos données existantes restent
              intactes et accessibles. Seul l&apos;ajout d&apos;un élément
              supplémentaire est refusé, avec un message explicite indiquant la
              limite atteinte. Rien n&apos;est supprimé, rien n&apos;est mis en
              lecture seule.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection id="ce-qui-est-inclus" title="Ce que vous pouvez faire avec le plan Gratuit">
          <p>
            Le plan {FREE.name} n&apos;est pas une démonstration : ce sont les
            mêmes modules que les plans payants, avec des quotas plus bas.
          </p>
          <ContentList
            items={[
              "Créer un logement complet : adresse, type, surface, pièces, prix et date d'acquisition, loyer et provision sur charges, statut.",
              "Enregistrer un locataire et son bail : loyer, charges, dépôt de garantie, dates d'entrée et de sortie.",
              "Suivre les loyers : les échéances sont générées automatiquement chaque mois et prennent les statuts payé, en attente, en retard ou partiel.",
              "Déposer des documents classés par catégorie (bail, état des lieux, assurance, diagnostics, factures, garanties) avec une date d'expiration facultative.",
              "Constituer une galerie de photos datées et classées (avant location, entrée, sortie, dommages, après travaux).",
              "Saisir des dépenses par catégorie, avec justificatif attaché.",
              "Suivre des travaux : entreprise, budget, coût réel, avancement, photos et facture rattachées.",
              "Consulter le tableau de bord et les statistiques de base : revenus encaissés, dépenses, résultat net, taux d'occupation.",
            ]}
          />
        </ContentSection>

        <ContentSection id="ce-qui-nest-pas-inclus" title="Ce qui n'est pas inclus">
          <p>
            Pour être utile, une page sur la gratuité doit aussi dire ce
            qu&apos;elle ne couvre pas.
          </p>
          <ContentSubtitle>Réservé au plan {STARTER.name} et au-delà</ContentSubtitle>
          <ContentList
            items={[
              "Les relances de loyer par e-mail, envoyées manuellement depuis la fiche d'une échéance.",
              "Les exports : sauvegarde complète au format JSON et export CSV des loyers.",
              `Le passage à ${propertiesLabel(STARTER)}.`,
            ]}
          />
          <ContentSubtitle>Réservé au plan {PRO.name} et au-delà</ContentSubtitle>
          <ContentList
            items={[
              "Les relances automatiques de loyer, planifiées sans intervention.",
              "Les messages de relance personnalisables.",
              "Le rapport mensuel envoyé par e-mail.",
              "Les statistiques avancées et l'historique complet.",
            ]}
          />
          <ContentNotice title="Valable pour tous les plans, y compris payants">
            <p>
              Nireo ne tient pas de comptabilité légale, n&apos;établit aucun
              bilan et ne produit aucune déclaration fiscale. Ce n&apos;est pas
              une limitation du plan Gratuit : aucun plan ne le fait.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection id="a-qui-ca-convient" title="À qui le plan Gratuit convient — et à qui il ne convient pas">
          <ComparisonTable
            caption="Situations couvertes ou non par le plan Gratuit de Nireo"
            leftLabel="Le plan Gratuit suffit"
            rightLabel="Un plan payant devient nécessaire"
            rows={[
              {
                criterion: "Nombre de biens",
                left: `${propertiesLabel(FREE)} loué.`,
                right: `À partir du deuxième logement (${STARTER.name} : ${propertiesLabel(STARTER)}).`,
              },
              {
                criterion: "Relances d'impayés",
                left: "Vous relancez vous-même, par vos propres moyens.",
                right: `Relance par e-mail depuis Nireo (${STARTER.name}), automatique (${PRO.name}).`,
              },
              {
                criterion: "Volume de documents",
                left: `Jusqu'à ${FREE.limits.maxDocuments} documents et ${FREE.limits.maxPhotos} photos.`,
                right: `Au-delà, ou si ${formatStorage(FREE.limits.storageMb)} ne suffisent plus.`,
              },
              {
                criterion: "Sauvegarde de vos données hors Nireo",
                left: "Non disponible : la demande passe par le support.",
                right: `Export JSON et CSV en autonomie à partir de ${STARTER.name}.`,
              },
              {
                criterion: "Analyse financière",
                left: "Revenus, dépenses, résultat net, taux d'occupation.",
                right: `Statistiques avancées et rapport mensuel à partir de ${PRO.name}.`,
              },
            ]}
          />
          <p>
            En résumé : si vous louez un logement et que vous cherchez surtout à
            ne plus perdre vos documents ni le fil de vos encaissements, le plan{" "}
            {FREE.name} suffit durablement. Si vous gérez plusieurs biens ou si
            vous voulez que l&apos;outil relance à votre place, il faudra un
            plan payant. Le détail complet figure sur la{" "}
            <Inline href="/tarifs">page Tarifs</Inline>.
          </p>
        </ContentSection>

        <ContentSection id="comment-commencer" title="Comment commencer">
          <p>
            La création de compte demande une adresse e-mail et un mot de passe,
            puis la confirmation de l&apos;adresse par un lien envoyé par
            e-mail. Vous arrivez ensuite sur un guide de démarrage qui vous fait
            créer votre premier logement, puis votre premier bail. À partir de
            là, les échéances mensuelles se génèrent seules.
          </p>
          <p>
            Pour comprendre la logique générale de l&apos;outil avant de créer
            un compte, la page{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>{" "}
            décrit chaque module. Si vous partez d&apos;un tableur, le guide{" "}
            <Inline href="/alternative-excel-gestion-locative">
              alternative à Excel
            </Inline>{" "}
            décrit la marche à suivre pour basculer sans tout ressaisir.
          </p>
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title={`Créez votre compte ${FREE.name}`}
          description="Une adresse e-mail suffit. Aucune carte bancaire, aucune durée limite, aucune fonction désactivée après un essai."
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
