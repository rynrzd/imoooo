import type { Metadata } from "next";
import { Centralisation } from "@/components/landing/centralisation";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingHero } from "@/components/landing/hero";
import { LandingTracker } from "@/components/landing/landing-tracker";
import { LinkedSection } from "@/components/landing/linked-section";
import { ProductPreview } from "@/components/landing/product-preview";
import { RevealOnScroll } from "@/components/landing/reveal-on-scroll";
import { JsonLd } from "@/components/seo/json-ld";
import { payloadOf } from "@/lib/landing/catalog";
import { getLandingResolution } from "@/lib/landing/server";
import {
  jsonLdGraph,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";

/**
 * Landing publique de Nireo.
 *
 * Cinq temps, dans cet ordre : le hook sur une photographie plein écran, le
 * produit réel, la section signature où l'interface devient le monogramme, la
 * centralisation, l'appel à l'action. Rien d'autre. La grille tarifaire et la
 * FAQ vivent sur /tarifs ; le choix du plan a lieu après l'inscription.
 *
 * Un seul `h1` (le hook). Chaque section a son `h2`. Tout le contenu est rendu
 * côté serveur : les seules parties client sont le header (menu, session), le
 * lien d'ancre fluide et l'observateur de révélations — aucune ne masque de
 * texte.
 *
 * Ce que le moteur de personnalisation décide encore : la destination et les
 * libellés des appels à l'action (visiteur / membre connecté) et le texte du
 * sous-titre. Les repères de mesure (`data-lx-section`, `data-lx`) sont
 * conservés à l'identique, les statistiques restent donc comparables.
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
 * Le balisage FAQPage suit la FAQ : il vit sur /tarifs, la seule page qui
 * porte réellement les questions. Aucun balisage sans contenu visible.
 */
const JSON_LD = jsonLdGraph([organizationJsonLd, webSiteJsonLd, softwareApplicationJsonLd]);

export default async function LandingPage() {
  const { content, profile } = await getLandingResolution();

  // Garde-fou : la variante « membre » du CTA renvoie vers /, c'est-à-dire le
  // tableau de bord. Servie à un visiteur ANONYME (variante épinglée dans la
  // configuration du moteur, règle mal ciblée…), elle le ferait rebondir sur
  // la connexion au lieu d'ouvrir l'inscription. On ne la sert donc que si la
  // session existe réellement ; sinon on retombe sur la formulation visiteur
  // du catalogue. Le moteur garde toutes ses autres décisions.
  const cta = profile.isAuthenticated ? content.cta : payloadOf("hero_cta", "control");

  return (
    <>
      <JsonLd data={JSON_LD} />

      {/* ---------------- Le hook, sur la photographie ---------------- */}
      <div data-lx-section="hero">
        <LandingHero cta={cta} subheadline={content.subheadline.text} />
      </div>

      {/* ---------------- Le produit, tel qu'il est ---------------- */}
      <section
        id="produit"
        data-lx-section="features"
        className="bg-[var(--nl-paper)] py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
          <div data-reveal>
            <h2 className="text-[clamp(1.9rem,6vw,3.2rem)] font-semibold text-[var(--nl-ink)]">
              <span className="block">Vous ouvrez Nireo.</span>
              <span className="block">Tout est déjà clair.</span>
            </h2>
            <p className="mt-5 max-w-md text-[clamp(0.95rem,2.4vw,1.08rem)] leading-relaxed text-[var(--nl-gray)]">
              <span className="block">Vos biens, vos documents et vos chiffres.</span>
              <span className="block">Rien à recouper.</span>
            </p>
          </div>

          <div className="mt-12 sm:mt-16" data-reveal style={{ ["--nl-delay" as string]: "120ms" }}>
            <ProductPreview />
          </div>

          {/* L'honnêteté est dite une fois, discrètement, sous l'aperçu. */}
          <p className="mt-5 text-[0.78rem] text-[var(--nl-gray)]">
            Aperçu de l’interface Nireo. Les logements et les montants affichés sont
            des exemples&nbsp;: aucune donnée réelle n’est utilisée.
          </p>
        </div>
      </section>

      {/* ---------------- Tout reste lié ---------------- */}
      <div data-lx-section="unify">
        <LinkedSection />
      </div>

      {/* ---------------- Un seul endroit ---------------- */}
      <div data-lx-section="proof">
        <Centralisation />
      </div>

      {/* ---------------- Action ---------------- */}
      <FinalCta href={cta.href} />

      {/* Révélations au défilement (aucune si le visiteur limite les animations). */}
      <RevealOnScroll />
      {/* Mesure du comportement réel (anonyme, non bloquante). */}
      <LandingTracker />
    </>
  );
}
