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
import { getPlan } from "@/config/plans";
import {
  PILLAR_PAGE,
  QUITTANCE_TOOL,
  RESOURCES_PAGE,
  getGuide,
  otherGuides,
} from "@/config/seo-pages";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/supabase/config";

const PAGE = getGuide("/suivi-loyers");
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
    question: "Comment les échéances de loyer sont-elles créées ?",
    answer:
      "Automatiquement, à partir des baux actifs. Pour chaque bail en cours, Nireo crée l'échéance du mois avec le montant attendu (loyer hors charges + provision sur charges). L'opération est idempotente : une échéance déjà créée n'est jamais dupliquée.",
  },
  {
    question: "Quels sont les statuts possibles d'un loyer ?",
    answer:
      "Quatre : payé lorsque le montant reçu couvre le montant attendu, partiel lorsqu'une partie seulement a été reçue, en attente tant que rien n'est reçu et que l'échéance n'est pas dépassée, en retard au-delà. Le statut découle des montants, il n'est pas choisi à la main.",
  },
  {
    question: "Nireo détecte-t-il automatiquement les virements reçus ?",
    answer:
      "Non. Nireo n'est pas connecté à votre banque et ne lit aucun relevé : c'est vous qui enregistrez le montant reçu et sa date. Le calcul du statut, le total encaissé et l'historique en découlent ensuite automatiquement.",
  },
  {
    question: "Nireo relance-t-il les locataires en retard ?",
    answer: `Selon le plan. Sur le plan ${FREE.name}, aucune relance n'est envoyée. À partir du plan ${STARTER.name}, vous déclenchez une relance par e-mail depuis l'échéance concernée. À partir du plan ${PRO.name}, les relances peuvent partir automatiquement, avec un message que vous personnalisez.`,
  },
  {
    question: "Peut-on enregistrer un paiement partiel ?",
    answer:
      "Oui. Vous saisissez le montant réellement reçu, même inférieur au montant attendu : l'échéance passe en statut partiel et l'écart reste visible. Un commentaire peut être ajouté pour garder le contexte.",
  },
  {
    question: "L'historique des loyers est-il conservé après le départ d'un locataire ?",
    answer:
      "Oui. La fin d'un bail ne supprime pas les échéances passées : elles restent rattachées au logement et au locataire concerné, et continuent d'alimenter les totaux annuels du bien.",
  },
  {
    question: "Nireo produit-il les quittances de loyer ?",
    answer:
      "L'application enregistre l'encaissement, sa date et son statut, mais n'édite pas encore la quittance depuis l'échéance. Nireo met en revanche à disposition un générateur de quittance de loyer gratuit, utilisable sans compte : le PDF obtenu peut ensuite être déposé dans la bibliothèque documentaire du logement.",
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

export default function SuiviLoyersPage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Guide"
          h1="Suivi des loyers : échéances, statuts et historique"
          lead="Le suivi des loyers ne demande pas un tableau de plus : il demande que l'échéance existe sans qu'on la crée, que le statut se déduise du montant reçu, et que l'historique reste consultable des années plus tard. Voici comment Nireo s'y prend."
          updatedAt={PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-14">
        <ContentSection id="principe" title="Le principe : l'échéance naît du bail">
          <p>
            Dans Nireo, vous ne créez pas de ligne de loyer. Vous enregistrez un
            bail — locataire, loyer hors charges, provision sur charges, dépôt de
            garantie, date d&apos;entrée — et l&apos;échéance mensuelle en
            découle. Chaque mois, pour chaque bail actif, l&apos;échéance
            attendue est créée avec son montant. Les échéances manquantes sont
            complétées à l&apos;ouverture de l&apos;application, sans jamais
            créer de doublon.
          </p>
          <p>
            Conséquence pratique : un mois ne peut pas être « oublié ». Il peut
            être impayé, ce qui est visible, mais il ne peut pas manquer du
            tableau.
          </p>
        </ContentSection>

        <ContentSection id="statuts" title="Les quatre statuts, et d'où ils viennent">
          <p>
            Le statut n&apos;est pas une couleur choisie à la main : il est
            déduit de la comparaison entre le montant attendu et le montant
            réellement encaissé.
          </p>
          <ContentList
            items={[
              <>
                <strong className="text-foreground">Payé</strong> — le montant
                reçu couvre le montant attendu.
              </>,
              <>
                <strong className="text-foreground">Partiel</strong> — une
                partie seulement a été reçue. L&apos;écart reste affiché.
              </>,
              <>
                <strong className="text-foreground">En attente</strong> — rien
                n&apos;a encore été reçu et l&apos;échéance n&apos;est pas
                dépassée.
              </>,
              <>
                <strong className="text-foreground">En retard</strong> — rien
                ou trop peu a été reçu et l&apos;échéance est passée.
              </>,
            ]}
          />
          <p>
            À chaque échéance, vous pouvez enregistrer le montant reçu, sa date
            d&apos;encaissement et un commentaire (accord sur un paiement en
            deux fois, virement annoncé, régularisation de charges…). Ce
            commentaire est souvent ce qui manque le plus dans un tableur.
          </p>
          <ContentNotice title="Nireo n'est pas connecté à votre banque">
            <p>
              Aucun relevé bancaire n&apos;est lu, aucun virement n&apos;est
              détecté automatiquement, aucun paiement n&apos;est encaissé par
              Nireo. C&apos;est vous qui constatez l&apos;encaissement ; Nireo
              en tire le statut, les totaux et l&apos;historique.
            </p>
          </ContentNotice>
        </ContentSection>

        <ContentSection id="au-quotidien" title="Le suivi au quotidien, en trois gestes">
          <StepList
            steps={[
              {
                title: "Constater",
                description:
                  "Le virement est arrivé : vous saisissez le montant reçu et sa date sur l'échéance du mois. Le statut se met à jour seul.",
              },
              {
                title: "Repérer",
                description:
                  "Les échéances en retard remontent dans le tableau de bord, avec le logement et le locataire concernés — sans avoir à parcourir le tableau.",
              },
              {
                title: "Relancer",
                description:
                  "Une relance par e-mail part depuis l'échéance concernée, manuellement ou automatiquement selon votre plan.",
              },
            ]}
          />
        </ContentSection>

        <ContentSection id="relances" title="Relances : ce que fait chaque plan">
          <ContentList
            items={[
              <>
                <strong className="text-foreground">{FREE.name}</strong> —
                aucune relance envoyée par Nireo. Les retards restent visibles
                dans l&apos;application, la relance se fait par vos propres
                moyens.
              </>,
              <>
                <strong className="text-foreground">{STARTER.name}</strong> —
                relance par e-mail déclenchée manuellement depuis
                l&apos;échéance concernée.
              </>,
              <>
                <strong className="text-foreground">{PRO.name} et au-delà</strong>{" "}
                — relances automatiques planifiées, message de relance
                personnalisable, rapport mensuel par e-mail et historique
                complet.
              </>,
            ]}
          />
          <p>
            Le détail par plan figure sur la{" "}
            <Inline href="/tarifs">page Tarifs</Inline>, et la logique générale
            de l&apos;outil sur la page{" "}
            <Inline href={PILLAR_PAGE.path}>logiciel de gestion locative</Inline>
            .
          </p>
        </ContentSection>

        <ContentSection id="historique" title="L'historique et les chiffres qui en découlent">
          <ContentSubtitle>Un registre qui ne se réécrit pas</ContentSubtitle>
          <p>
            Les échéances passées restent rattachées au logement et au locataire
            concerné, y compris après la fin d&apos;un bail. Vous retrouvez donc
            l&apos;historique d&apos;occupation et d&apos;encaissement d&apos;un
            bien sur toute sa durée de détention, et pas seulement sur
            l&apos;année en cours.
          </p>

          <ContentSubtitle>Des totaux dérivés, jamais saisis</ContentSubtitle>
          <p>
            Les revenus encaissés du mois et de l&apos;année, le montant attendu,
            le nombre de retards, les dépenses et le résultat net sont calculés à
            partir de ce registre et des dépenses enregistrées. Aucun total
            n&apos;est stocké en double : corriger un encaissement met à jour
            tous les chiffres qui en dépendent.
          </p>

          <ContentSubtitle>Une sortie possible à tout moment</ContentSubtitle>
          <p>
            À partir du plan {STARTER.name}, un export CSV des loyers et un
            export JSON complet sont disponibles depuis les paramètres — pour
            transmettre à un comptable ou simplement garder une copie hors de
            l&apos;outil.
          </p>

          <ContentSubtitle>Et la quittance à remettre au locataire ?</ContentSubtitle>
          <p>
            Elle ne s&apos;édite pas encore depuis l&apos;échéance. En attendant,
            le{" "}
            <Link
              href={QUITTANCE_TOOL.path}
              className="text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              générateur de quittance de loyer
            </Link>{" "}
            de Nireo est gratuit et s&apos;utilise sans compte : le PDF obtenu se
            dépose ensuite dans la bibliothèque documentaire du logement. Si le
            locataire n&apos;a réglé qu&apos;une partie de sa dette, il produit un
            reçu de paiement partiel plutôt qu&apos;une quittance.
          </p>
        </ContentSection>

        <ContentSection id="faq" title="Questions fréquentes">
          <FaqSection items={FAQ} />
        </ContentSection>

        <RelatedPages pages={[PILLAR_PAGE, ...otherGuides(PAGE.path)]} />

        <ContentCta
          title="Arrêtez de recréer le tableau chaque mois"
          description="Enregistrez un bail : les échéances suivantes se génèrent seules, avec leur statut et leur historique."
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
