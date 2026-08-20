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
  ContentWide,
  RelatedPages,
  StepList,
} from "@/components/seo/content";
import { FaqSection, type FaqItem } from "@/components/marketing/faq-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import {
  formatStorage,
  getPlan,
  propertiesLabel,
  propertiesQuotaSentence,
} from "@/config/plans";
import { GUIDES, PILLAR_PAGE, RESOURCES_PAGE } from "@/config/seo-pages";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";
import { isStripeConfigured } from "@/lib/stripe/config";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Page pilier « logiciel de gestion locative ».
 *
 * Entièrement rendue côté serveur : aucun texte n'est caché derrière un
 * clic, un onglet ou un carrousel. Chaque fonction citée existe réellement
 * dans l'application ; chaque prix et chaque quota vient de
 * src/config/plans.ts ; l'état du paiement vient de la configuration Stripe
 * réelle du serveur.
 */

export const metadata: Metadata = {
  title: { absolute: `${PILLAR_PAGE.title} | Nireo` },
  description: PILLAR_PAGE.description,
  alternates: { canonical: PILLAR_PAGE.path },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    url: PILLAR_PAGE.path,
    title: PILLAR_PAGE.title,
    description: PILLAR_PAGE.description,
  },
};

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: PILLAR_PAGE.shortTitle, path: PILLAR_PAGE.path },
];

const FREE = getPlan("free");
const STARTER = getPlan("starter");
const PRO = getPlan("pro");
const BUSINESS = getPlan("business");

const FAQ: FaqItem[] = [
  {
    question: "Qu'est-ce qu'un logiciel de gestion locative ?",
    answer:
      "C'est un outil qui rassemble au même endroit les informations d'un patrimoine loué : les logements, les locataires et leurs baux, les échéances de loyer et leur encaissement, les documents obligatoires, les dépenses et les travaux. Il remplace le tableur, les dossiers papier et les fichiers dispersés, et permet de retrouver une information sans la chercher.",
  },
  {
    question: "Nireo est-il une agence immobilière ?",
    answer:
      "Non. Nireo est un logiciel d'autogestion : il vous aide à gérer vous-même vos locations. Nireo ne rédige pas vos baux à votre place, ne recherche pas de locataires, n'encaisse aucun loyer et n'intervient dans aucune relation contractuelle avec vos locataires.",
  },
  {
    question: "Combien de logements puis-je gérer avec Nireo ?",
    answer: `Cela dépend du plan choisi — ${propertiesQuotaSentence()} La limite est appliquée côté serveur : vos logements existants restent toujours accessibles, seul l'ajout d'un logement supplémentaire est bloqué au-delà du quota.`,
  },
  {
    question: "Nireo est-il vraiment gratuit ?",
    answer: `Le plan Gratuit est permanent, sans carte bancaire et sans durée limite. Il couvre ${propertiesLabel(FREE)} et ${FREE.limits.maxActiveTenants} locataire actif, avec les loyers, les dépenses, les travaux, ${FREE.limits.maxDocuments} documents, ${FREE.limits.maxPhotos} photos et ${formatStorage(FREE.limits.storageMb)} de stockage. Au-delà, un plan payant est nécessaire.`,
  },
  {
    question: "Nireo convient-il à une SCI ?",
    answer:
      "Oui pour centraliser les biens, les locataires, les baux, les loyers, les dépenses et les justificatifs d'une SCI dans un seul espace. Non pour la comptabilité légale : Nireo ne tient pas de comptabilité au sens juridique, n'établit aucun bilan et ne produit aucune déclaration fiscale.",
  },
  {
    question: "Mes données sont-elles isolées des autres comptes ?",
    answer:
      "Oui. Chaque donnée est rattachée à un compte propriétaire et l'isolation est appliquée par la base de données elle-même, pas seulement par l'interface. Les fichiers sont stockés dans un espace privé, servis par des liens signés à durée limitée. L'hébergement est situé en Europe.",
  },
  {
    question: "Puis-je utiliser Nireo depuis mon téléphone ?",
    answer:
      "Oui. Nireo est une application web responsive : elle s'ouvre dans un navigateur sur ordinateur, tablette et smartphone, sans installation ni magasin d'applications.",
  },
];

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd({
    name: PILLAR_PAGE.title,
    description: PILLAR_PAGE.description,
    path: PILLAR_PAGE.path,
    dateModified: PILLAR_PAGE.updatedAt,
  }),
  breadcrumbJsonLd(CRUMBS),
  faqPageJsonLd(FAQ, `${SITE_URL}${PILLAR_PAGE.path}`),
]);

/** Lien interne discret, au fil du texte. */
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

export default function LogicielGestionLocativePage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Gestion locative"
          h1="Le logiciel de gestion locative pour les propriétaires bailleurs"
          lead="Nireo réunit vos logements, vos locataires, vos baux, vos loyers, vos documents, vos dépenses et vos travaux dans un seul espace. Vous gardez la main sur votre gestion — l'outil se charge de la tenir à jour."
          updatedAt={PILLAR_PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
      <ContentSection id="qu-est-ce-que-nireo" title="Nireo, en une réponse">
        <p>
          Nireo est un <strong className="text-foreground">logiciel de gestion locative</strong>{" "}
          en ligne destiné aux propriétaires bailleurs qui gèrent eux-mêmes leurs
          locations. Vous créez un compte, vous décrivez vos logements, vous
          rattachez vos locataires et leurs baux : Nireo génère ensuite chaque
          mois les échéances de loyer, conserve vos documents par logement, suit
          vos dépenses et vos chantiers, et calcule vos revenus, vos charges et
          votre résultat net.
        </p>
        <p>
          Il s&apos;adresse aussi bien à un propriétaire d&apos;un seul studio
          qu&apos;à un patrimoine de plusieurs logements détenu en direct, en
          indivision familiale ou via une SCI. Aucune compétence comptable
          n&apos;est nécessaire.
        </p>
        <ContentNotice title="Ce que Nireo n'est pas">
          <p>
            Nireo n&apos;est <strong className="text-foreground">pas une agence
            immobilière</strong> et ne pratique pas la gestion déléguée : il ne
            recherche pas de locataires, ne rédige pas vos baux à votre place,
            n&apos;encaisse aucun loyer et n&apos;intervient dans aucune relation
            contractuelle avec vos locataires.
          </p>
          <p>
            Nireo n&apos;est pas non plus un logiciel de comptabilité légale : il
            ne tient pas de comptabilité au sens juridique, n&apos;établit aucun
            bilan et ne produit aucune déclaration fiscale.
          </p>
        </ContentNotice>
      </ContentSection>

      <ContentSection
        id="gestion-immobiliere-gestion-locative-autogestion"
        title="Gestion immobilière, gestion locative déléguée, autogestion : quelles différences ?"
      >
        <p>
          Ces trois expressions sont souvent employées l&apos;une pour
          l&apos;autre alors qu&apos;elles ne recouvrent pas le même travail —
          ni le même coût.
        </p>
        <ContentSubtitle>La gestion immobilière</ContentSubtitle>
        <p>
          C&apos;est le terme le plus large : tout ce qui touche à la vie
          d&apos;un bien immobilier, qu&apos;il soit loué ou non — acquisition,
          entretien, travaux, valorisation, revente. Elle englobe la gestion
          locative sans s&apos;y réduire.
        </p>
        <ContentSubtitle>La gestion locative déléguée</ContentSubtitle>
        <p>
          Vous confiez la gestion de vos locations à un professionnel (agence,
          administrateur de biens). Il recherche les locataires, rédige les
          baux, encaisse les loyers, relance les impayés et vous reverse les
          sommes, contre des honoraires généralement calculés en pourcentage des
          loyers encaissés. Vous déléguez le travail et une part du revenu.
        </p>
        <ContentSubtitle>L&apos;autogestion, avec un logiciel</ContentSubtitle>
        <p>
          Vous restez le gestionnaire de vos biens et un logiciel prend en charge
          l&apos;organisation : suivi des échéances, classement des documents,
          historique des encaissements, dépenses, travaux et chiffres
          consolidés. C&apos;est la catégorie de Nireo. Le coût est un
          abonnement fixe, indépendant du montant de vos loyers, et la relation
          avec vos locataires reste directe.
        </p>
      </ContentSection>

      <ContentSection id="limites-excel" title="Pourquoi le tableur finit par coûter du temps">
        <p>
          Beaucoup de propriétaires commencent avec un fichier Excel ou Google
          Sheets, quelques dossiers sur l&apos;ordinateur et des photos sur le
          téléphone. Tant qu&apos;il y a un logement et un locataire stable,
          cela fonctionne. Les frictions apparaissent avec le temps, plus
          qu&apos;avec le nombre de biens :
        </p>
        <ContentList
          items={[
            <>
              <strong className="text-foreground">L&apos;information est
              éparpillée.</strong> Le bail est dans un dossier, la quittance
              dans la boîte mail, la facture de chaudière dans les
              téléchargements, les photos de l&apos;état des lieux dans la
              galerie du téléphone. Retrouver un document demande de chercher à
              trois endroits.
            </>,
            <>
              <strong className="text-foreground">Le suivi est manuel.</strong>{" "}
              Chaque mois, il faut ajouter une ligne par locataire, vérifier si
              le virement est arrivé, mettre à jour la couleur de la cellule.
              Une ligne oubliée devient un impayé découvert trois mois plus tard.
            </>,
            <>
              <strong className="text-foreground">Les formules se cassent
              en silence.</strong> Une ligne insérée, une plage décalée, un
              copier-coller malheureux : le total reste affiché, mais il est
              faux, et rien ne le signale.
            </>,
            <>
              <strong className="text-foreground">L&apos;historique se
              perd.</strong> « Combien ai-je dépensé sur ce logement depuis
              l&apos;achat ? » demande de rouvrir les fichiers des années
              précédentes — quand ils existent encore.
            </>,
            <>
              <strong className="text-foreground">Le fichier vit sur une seule
              machine.</strong> Une sauvegarde oubliée, un disque qui lâche, et
              plusieurs années de suivi disparaissent.
            </>,
          ]}
        />
        <p>
          Le tableur n&apos;est pas un mauvais outil : il est simplement
          généraliste. Il ne sait pas qu&apos;un bail génère une échéance chaque
          mois, qu&apos;un diagnostic expire, ou qu&apos;une facture de travaux
          est aussi une dépense. C&apos;est ce lien entre les données qu&apos;un
          logiciel dédié apporte. Le sujet est détaillé dans le guide{" "}
          <Inline href="/alternative-excel-gestion-locative">
            alternative à Excel pour la gestion locative
          </Inline>
          .
        </p>
      </ContentSection>

      <ContentSection id="fonctionnalites" title="Ce que Nireo fait réellement">
        <p>
          Chaque module ci-dessous existe dans l&apos;application aujourd&apos;hui.
          Rien n&apos;est annoncé « bientôt » sans le dire.
        </p>
        <ContentList
          items={[
            <>
              <strong className="text-foreground">Logements</strong> — adresse,
              type, surface, nombre de pièces, prix et date d&apos;acquisition,
              loyer et provision sur charges, statut (loué, vacant, en travaux).
              Chaque logement devient le point d&apos;entrée de tout le reste.
            </>,
            <>
              <strong className="text-foreground">Locataires</strong> —
              coordonnées, logement occupé, dates d&apos;entrée et de sortie.
              Un locataire sorti reste dans l&apos;historique du logement.
            </>,
            <>
              <strong className="text-foreground">Baux</strong> — loyer hors
              charges, provision sur charges, dépôt de garantie, période de
              location. Ce sont ces éléments qui alimentent automatiquement les
              échéances.
            </>,
            <>
              <strong className="text-foreground">Loyers</strong> — les
              échéances des baux actifs sont générées automatiquement chaque
              mois, avec quatre statuts : payé, en attente, en retard, partiel.
              Vous enregistrez l&apos;encaissement, la date et un commentaire ;
              l&apos;historique se construit tout seul. Détail dans le guide{" "}
              <Inline href="/suivi-loyers">suivi des loyers</Inline>.
            </>,
            <>
              <strong className="text-foreground">Documents</strong> — baux,
              états des lieux, assurances, diagnostics, factures et garanties,
              classés par logement et par catégorie, avec une date
              d&apos;expiration facultative pour être prévenu avant échéance.
            </>,
            <>
              <strong className="text-foreground">Photos</strong> — galerie
              datée et classée par logement (avant location, entrée, sortie,
              dommages, après travaux), stockée dans un espace privé.
            </>,
            <>
              <strong className="text-foreground">Dépenses</strong> — montant,
              date, fournisseur et catégorie (travaux, assurance, taxe
              foncière, copropriété, autres), avec justificatif attaché.
            </>,
            <>
              <strong className="text-foreground">Travaux</strong> — chantier
              par logement : entreprise, budget prévu, coût réel, dates,
              avancement, photos et facture rattachées. Une dépense est créée
              en regard, sans double saisie.
            </>,
            <>
              <strong className="text-foreground">Statistiques</strong> —
              revenus encaissés, dépenses, résultat net, rendement brut et taux
              d&apos;occupation, calculés en continu à partir de vos données
              réelles. Aucun chiffre n&apos;est saisi deux fois : tout est
              dérivé des loyers et des dépenses enregistrés.
            </>,
          ]}
        />
        <p>
          Selon le plan, s&apos;ajoutent les relances de loyer par e-mail
          (manuelles à partir de {STARTER.name}, automatiques à partir de{" "}
          {PRO.name}), les exports JSON et CSV, le rapport mensuel par e-mail,
          la carte du patrimoine et le centre de pilotage. Le détail figure
          dans le <Inline href="/tarifs">comparatif des plans</Inline>.
        </p>
      </ContentSection>

      <ContentSection id="excel-vs-nireo" title="Excel ou Nireo : ce qui change concrètement">
        <p>
          Comparaison sur des points vérifiables, sans caricature : Excel reste
          un excellent tableur, mais il n&apos;a pas été conçu pour suivre des
          baux.
        </p>
        <ComparisonTable
          caption="Comparaison entre un tableur et Nireo pour la gestion locative"
          leftLabel="Tableur (Excel, Sheets)"
          rightLabel="Nireo"
          rows={[
            {
              criterion: "Échéances de loyer",
              left: "Une ligne à créer manuellement chaque mois, pour chaque locataire.",
              right: "Générées automatiquement à partir des baux actifs, chaque mois.",
            },
            {
              criterion: "Statut d'un loyer",
              left: "Une couleur ou un mot saisi à la main, sans règle.",
              right: "Payé, en attente, en retard ou partiel, déduit des montants encaissés.",
            },
            {
              criterion: "Documents",
              left: "Dans des dossiers séparés du fichier de suivi.",
              right: "Rattachés au logement, classés par catégorie, avec date d'expiration.",
            },
            {
              criterion: "Photos",
              left: "Sur le téléphone ou dans un dossier, sans lien avec le bien.",
              right: "Galerie par logement, datée et catégorisée (entrée, sortie, travaux…).",
            },
            {
              criterion: "Dépenses et travaux",
              left: "Un onglet à part, rarement relié aux loyers.",
              right: "Rattachés au logement ; une dépense est créée avec le chantier.",
            },
            {
              criterion: "Résultat net et rendement",
              left: "Des formules à écrire et à maintenir soi-même.",
              right: "Calculés en continu à partir des loyers et dépenses enregistrés.",
            },
            {
              criterion: "Accès",
              left: "Le fichier, là où il est enregistré.",
              right: "Un navigateur, sur ordinateur, tablette ou téléphone.",
            },
            {
              criterion: "Sauvegarde",
              left: "À la charge de l'utilisateur.",
              right: "Chaque action est enregistrée immédiatement en base.",
            },
            {
              criterion: "Coût",
              left: "Inclus dans une suite bureautique déjà payée.",
              right: `Gratuit pour ${propertiesLabel(FREE)}, puis un abonnement fixe indépendant du montant des loyers.`,
            },
          ]}
        />
        <p>
          Si votre patrimoine tient sur cinq lignes et n&apos;évolue pas, le
          tableur suffit très bien. L&apos;intérêt d&apos;un outil dédié
          apparaît quand les documents, les dépenses et l&apos;historique
          commencent à peser autant que le suivi des encaissements.
        </p>
      </ContentSection>

      <ContentSection id="comment-ca-marche" title="Comment ça marche, en trois étapes">
        <StepList
          steps={[
            {
              title: "Créez vos logements",
              description:
                "Adresse, type, surface, prix d'acquisition, loyer et charges. C'est la base à laquelle tout se rattache ensuite.",
            },
            {
              title: "Ajoutez locataires et baux",
              description:
                "Coordonnées, loyer, provision sur charges, dépôt de garantie, dates d'entrée et de sortie. Les échéances mensuelles en découlent automatiquement.",
            },
            {
              title: "Suivez au fil de l'eau",
              description:
                "Vous notez les encaissements, déposez les documents et les factures, saisissez les dépenses. Le tableau de bord et les statistiques se mettent à jour seuls.",
            },
          ]}
        />
        <p>
          Un guide de démarrage vous accompagne à la première connexion et
          l&apos;import d&apos;un fichier de logements est possible depuis les
          paramètres, pour ne pas tout ressaisir.
        </p>
      </ContentSection>

      <ContentSection id="pour-qui" title="Un logement, plusieurs biens, ou une SCI">
        <ContentSubtitle>Vous avez un seul logement en location</ContentSubtitle>
        <p>
          Le plan {FREE.name} couvre exactement ce cas :{" "}
          {propertiesLabel(FREE)}, {FREE.limits.maxActiveTenants} locataire
          actif, les loyers, les dépenses, les travaux,{" "}
          {FREE.limits.maxDocuments} documents et {FREE.limits.maxPhotos} photos
          dans {formatStorage(FREE.limits.storageMb)} de stockage. Sans carte
          bancaire et sans limite de durée. C&apos;est souvent suffisant pour
          arrêter de chercher un bail dans ses e-mails. Voir le guide{" "}
          <Inline href="/logiciel-gestion-locative-gratuit">
            logiciel de gestion locative gratuit
          </Inline>
          .
        </p>
        <ContentSubtitle>Vous gérez plusieurs biens</ContentSubtitle>
        <p>
          À partir de deux ou trois logements, la charge n&apos;est plus le
          calcul mais la mémoire : qui a payé, quel diagnostic expire, quelle
          facture correspond à quel chantier. Les plans {STARTER.name} (
          {propertiesLabel(STARTER)}) et {PRO.name} ({propertiesLabel(PRO)})
          ajoutent les relances par e-mail, les exports et, pour {PRO.name}, les
          statistiques avancées et le rapport mensuel. Le guide{" "}
          <Inline href="/gestion-locative-proprietaire-bailleur">
            gestion locative pour propriétaire bailleur
          </Inline>{" "}
          décrit l&apos;organisation mois par mois.
        </p>
        <ContentSubtitle>Vous détenez vos biens en SCI</ContentSubtitle>
        <p>
          Nireo centralise les logements, les locataires, les baux, les loyers,
          les dépenses et les justificatifs de la société dans un espace unique,
          ce qui rend la préparation des chiffres beaucoup plus simple. En
          revanche, Nireo ne tient pas la comptabilité de la SCI et ne produit
          aucune déclaration : ces obligations restent celles du gérant et de
          son comptable. Le guide{" "}
          <Inline href="/gestion-locative-sci">gestion locative pour SCI</Inline>{" "}
          précise ce partage.
        </p>
        <p>
          Pour un patrimoine établi, le plan {BUSINESS.name} (
          {propertiesLabel(BUSINESS)}) ajoute la carte interactive du
          patrimoine, le centre de pilotage, l&apos;accès anticipé aux nouvelles
          fonctions et le support prioritaire.
        </p>
      </ContentSection>
      </ContentColumn>

      <ContentWide>
        <section id="tarifs" className="scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-[1.75rem]">
            Les offres Nireo
          </h2>
          <p className="mt-4 max-w-3xl text-[0.95rem] leading-relaxed text-muted-foreground">
            Quatre plans, un tarif fixe par mois, sans commission sur vos loyers.
            Chaque compte démarre sur le plan {FREE.name}.
          </p>
          {/* Grille et comparatif dérivés de src/config/plans.ts — aucune
              valeur tarifaire n'est ressaisie dans cette page. */}
          <div className="mt-8">
            <PricingSection paymentsEnabled={isStripeConfigured} />
          </div>
        </section>
      </ContentWide>

      <ContentColumn className="space-y-14">
        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[RESOURCES_PAGE, ...GUIDES]} title="Guides détaillés" />

        <ContentCta
          title="Commencez avec votre premier logement"
          description={`Créez votre compte en quelques minutes. Le plan ${FREE.name} est permanent et ne demande aucune carte bancaire.`}
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
