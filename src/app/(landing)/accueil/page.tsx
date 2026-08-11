import type { Metadata } from "next";
import { FaqBlock } from "@/components/landing/faq-block";
import { LandingHero } from "@/components/landing/hero";
import { LandingTracker } from "@/components/landing/landing-tracker";
import { EditorialBreak, FinalCta } from "@/components/landing/night-sections";
import { BeforeAfter, Patrimony } from "@/components/landing/patrimony";
import { PricingRows } from "@/components/landing/pricing-rows";
import { ProductStory } from "@/components/landing/product-story";
import { TestimonialsBand } from "@/components/landing/testimonials-band";
import { TrustStrip } from "@/components/landing/trust-strip";
import { getLandingFaqItems } from "@/components/marketing/faq-section";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { Reveal } from "@/components/marketing/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { getEngineState } from "@/lib/landing/config";
import { getLandingResolution } from "@/lib/landing/server";
import type { SectionKey } from "@/lib/landing/types";
import {
  faqPageJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";
import { isStripeConfigured } from "@/lib/stripe/config";
import { SITE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/**
 * Landing publique de Nireo.
 *
 * Récit : le hook, ce que le produit fait vraiment, une respiration, le
 * patrimoine réuni, la comparaison, les tarifs, les objections, l'action.
 * L'ordre est FIXE — c'est une narration, pas une liste de blocs
 * interchangeables (le slot « ordre des sections » du moteur est gelé en
 * conséquence, cf. src/lib/landing/catalog.ts).
 *
 * Ce que le moteur de personnalisation continue de décider :
 * - la destination et le libellé des appels à l'action (visiteur / membre) ;
 * - le plan mis en avant dans les tarifs ;
 * - l'affichage de témoignages RÉELS s'il en existe.
 *
 * Ce qui est rendu côté serveur : absolument tout le contenu. Les seules
 * parties client sont le header, la section produit (suivi du défilement) et
 * la grille tarifaire (événement interne) — aucune ne masque de texte.
 */

export const metadata: Metadata = {
  title: {
    absolute: "Nireo — Loyers, baux et documents réunis dans un seul espace",
  },
  description:
    "Nireo réunit vos loyers, vos locataires, vos documents et vos dépenses dans un seul espace clair. Gratuit pour un premier logement, sans carte bancaire.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Nireo",
    locale: "fr_FR",
    title: "Nireo — Loyers, baux et documents réunis dans un seul espace",
    description:
      "Loyers, locataires, documents et dépenses réunis dans un espace conçu pour les propriétaires bailleurs.",
    url: "/",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: "Nireo — Le logiciel de gestion locative" },
    ],
  },
};

/** La personnalisation lit les cookies : la page est rendue à chaque requête. */
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */

/**
 * Section de contenu. `data-lx-section` est le repère lu par le moteur de
 * mesure (vues, temps passé, sorties) — il est conservé à l'identique pour
 * que les statistiques restent comparables.
 */
function Section({
  id,
  track,
  className,
  children,
}: {
  id?: string;
  /** Clé de mesure : celles du moteur, plus le hero et l'appel final. */
  track?: SectionKey | "hero" | "cta";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-lx-section={track} className={cn("py-16 sm:py-24", className)}>
      <div className="mx-auto w-full max-w-[76rem] px-4 sm:px-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Le même tableau alimente l'accordéon visible et le balisage FAQPage :
 * les deux ne peuvent donc pas diverger.
 */
const FAQ_ITEMS = getLandingFaqItems({ paymentsEnabled: isStripeConfigured });

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  softwareApplicationJsonLd,
  faqPageJsonLd(FAQ_ITEMS, `${SITE_URL}/`),
]);

/* ------------------------------------------------------------------ */

export default async function LandingPage() {
  const [{ content }, state] = await Promise.all([getLandingResolution(), getEngineState()]);
  const { testimonials } = state.capabilities;
  const showTestimonials = content.proof.kind === "testimonials" && testimonials.length >= 2;

  return (
    <>
      <JsonLd data={JSON_LD} />

      {/* ---------------- Le hook ---------------- */}
      <div data-lx-section="hero">
        <LandingHero cta={content.cta} subheadline={content.subheadline.text} />
      </div>

      {/* ---------------- Ce qui est réellement tenu ---------------- */}
      <div data-lx-section="proof">
        <TrustStrip />
      </div>

      {/* ---------------- Le produit, en trois temps ---------------- */}
      <Section id="fonctionnalites" track="features">
        <Reveal className="max-w-2xl">
          <p className="land-eyebrow text-muted-foreground">Dans Nireo</p>
          <h2 className="mt-4 text-[1.9rem] font-semibold text-balance text-foreground sm:text-[2.5rem]">
            Ce que vous ouvrez le matin.
          </h2>
        </Reveal>
        <div className="mt-12 sm:mt-16">
          <ProductStory />
        </div>
      </Section>

      {/* ---------------- Respiration ---------------- */}
      <EditorialBreak />

      {/* ---------------- Tout au même endroit ---------------- */}
      <Section id="decouvrir" track="unify">
        <Patrimony />
      </Section>

      {/* ---------------- La différence ---------------- */}
      <Section className="border-t border-border">
        <BeforeAfter />
        {showTestimonials ? (
          <div className="mt-16 border-t border-border pt-12 sm:mt-20">
            <TestimonialsBand testimonials={testimonials} />
          </div>
        ) : null}
      </Section>

      {/* ---------------- Tarifs ---------------- */}
      <Section
        id="tarifs"
        track="pricing"
        className="border-t border-border bg-[color-mix(in_srgb,var(--land-paper)_55%,var(--land-ivory))]"
      >
        <Reveal className="max-w-2xl">
          <p className="land-eyebrow text-muted-foreground">Tarifs</p>
          <h2 className="mt-4 text-[1.9rem] font-semibold text-balance text-foreground sm:text-[2.5rem]">
            Un plan par taille de patrimoine.
          </h2>
          <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-muted-foreground">
            Démarrez gratuitement avec un logement, changez de plan quand votre
            patrimoine grandit.
          </p>
        </Reveal>
        <div className="mt-10 sm:mt-12">
          <PricingRows
            emphasis={content.pricingEmphasis.plan}
            paymentsEnabled={isStripeConfigured}
          />
          {/* Bandeau compact : disparaît de lui-même si l'offre est terminée. */}
          <div className="mt-8">
            <FounderOffer compact stripeEnabled={isStripeConfigured} />
          </div>
        </div>
      </Section>

      {/* ---------------- Objections ---------------- */}
      <Section id="faq" track="faq" className="border-t border-border">
        <FaqBlock items={FAQ_ITEMS} />
      </Section>

      {/* ---------------- Action ---------------- */}
      <FinalCta href={content.cta.href} />

      {/* Mesure du comportement réel (anonyme, non bloquante). */}
      <LandingTracker />
    </>
  );
}
