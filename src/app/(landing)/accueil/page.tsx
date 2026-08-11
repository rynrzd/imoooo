import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/hero";
import { LandingTracker } from "@/components/landing/landing-tracker";
import { FinalCta } from "@/components/landing/final-cta";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { TrustStrip } from "@/components/landing/trust-strip";
import { Reveal } from "@/components/marketing/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { getLandingResolution } from "@/lib/landing/server";
import {
  jsonLdGraph,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";

/**
 * Landing publique de Nireo — COURTE.
 *
 * Un seul écran de photographie et le hook, une transition franche vers le
 * produit réel, une ligne de confiance, un appel à l'action. Rien d'autre :
 * la grille tarifaire vit sur /tarifs (lien discret dans le header et le
 * footer), la FAQ aussi. Pas de comparaison « avant/après », pas de liste de
 * fonctionnalités, pas de section répétée.
 *
 * Ce que le moteur de personnalisation décide encore : la destination et les
 * libellés des appels à l'action (visiteur / membre connecté), et le texte du
 * sous-titre. Le reste de la page est écrit en dur — c'est une composition,
 * pas un assemblage de blocs interchangeables.
 *
 * Les repères de mesure (`data-lx-section`, `data-lx`) sont conservés à
 * l'identique : les statistiques du hero et des CTA restent comparables.
 */

export const metadata: Metadata = {
  title: {
    absolute: "Nireo — Loyers, baux et documents réunis dans un seul espace",
  },
  description:
    "Nireo réunit vos loyers, vos baux, vos locataires et vos documents dans un seul espace clair. Gratuit pour un premier logement, sans carte bancaire.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Nireo",
    locale: "fr_FR",
    title: "Nireo — Loyers, baux et documents réunis dans un seul espace",
    description:
      "Loyers, baux, locataires et documents réunis dans un espace conçu pour les propriétaires bailleurs.",
    url: "/",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: "Nireo — Le logiciel de gestion locative" },
    ],
  },
};

/** La personnalisation lit les cookies : la page est rendue à chaque requête. */
export const dynamic = "force-dynamic";

/**
 * Le balisage FAQPage a suivi la FAQ : il vit désormais sur /tarifs, la seule
 * page qui porte réellement les questions. Aucun balisage sans contenu visible.
 */
const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  softwareApplicationJsonLd,
]);

export default async function LandingPage() {
  const { content } = await getLandingResolution();

  return (
    <>
      <JsonLd data={JSON_LD} />

      {/* ---------------- Le hook, sur la photographie ---------------- */}
      <div data-lx-section="hero">
        <LandingHero cta={content.cta} subheadline={content.subheadline.text} />
      </div>

      {/* ---------------- Le produit, un seul écran ---------------- */}
      <section
        id="fonctionnalites"
        data-lx-section="features"
        className="border-t border-border py-16 sm:py-24"
      >
        <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-6">
          <Reveal>
            <h2 className="max-w-[18ch] text-[1.9rem] font-semibold text-balance text-foreground sm:text-[2.6rem]">
              Tout ce qui était éparpillé retrouve sa place.
            </h2>
          </Reveal>

          <div className="mt-10 sm:mt-14">
            <ProductShowcase />
          </div>

          {/* L'honnêteté est dite UNE fois, sous le cadre — jamais une
              pastille répétée sur chaque écran. */}
          <p className="mt-6 text-[0.78rem] text-muted-foreground">
            Aperçu de l’interface Nireo. Les logements et les montants affichés
            sont des exemples.
          </p>
        </div>
      </section>

      {/* ---------------- Ce qui est réellement tenu ---------------- */}
      <div data-lx-section="proof" className="border-t border-border py-7">
        <TrustStrip />
      </div>

      {/* ---------------- Action ---------------- */}
      <FinalCta href={content.cta.href} />

      {/* Mesure du comportement réel (anonyme, non bloquante). */}
      <LandingTracker />
    </>
  );
}
