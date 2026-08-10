import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingTracker } from "@/components/landing/landing-tracker";
import { ProofSection, proofHeading } from "@/components/landing/proof-section";
import { FaqSection, getLandingFaqItems } from "@/components/marketing/faq-section";
import { FeatureBlocks } from "@/components/marketing/feature-blocks";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { HeroCockpit } from "@/components/marketing/hero-cockpit";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Reveal } from "@/components/marketing/reveal";
import { UnifyScene } from "@/components/marketing/unify-scene";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { PILLAR_PAGE, RESOURCES_PAGE } from "@/config/seo-pages";
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
 * Landing page « intelligente ».
 *
 * Le contenu (titre, sous-titre, boutons, média, preuve, mise en avant
 * tarifaire, ordre des sections) est résolu CÔTÉ SERVEUR par le moteur
 * Landing Intelligence, à partir du profil du visiteur et des performances
 * réellement mesurées. Le HTML arrive donc déjà personnalisé : aucun
 * rechargement, aucun scintillement, aucun script bloquant.
 *
 * Les robots d'indexation reçoivent systématiquement la version de référence
 * (contenu canonique stable) : le SEO n'est jamais affecté.
 *
 * Structure : hero + cinq sections (au plus) + appel à l'action final.
 * Aucune numérotation de section, aucune démonstration interactive, aucune
 * vidéo — uniquement des fonctions réellement disponibles dans Nireo.
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

function SectionHead({
  eyebrow,
  title,
  keyword,
  description,
}: {
  eyebrow: string;
  title: string;
  keyword?: string;
  description?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-medium tracking-widest text-primary uppercase">
        {eyebrow}
      </span>
      <h2 className="mt-3.5 text-[1.75rem] font-semibold text-balance text-foreground sm:text-[2.4rem]">
        {title} {keyword ? <span className="nireo-shine">{keyword}</span> : null}
      </h2>
      {description ? (
        <p className="mt-5 text-[0.98rem] leading-relaxed text-balance text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

/** `data-lx-section` : repère lu par le moteur de mesure (vues, temps, sorties). */
function Section({
  id,
  track,
  className,
  children,
}: {
  id?: string;
  track: SectionKey;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-lx-section={track}
      // Le `scroll-margin-top` vient de globals.css (`.nireo [id]`) : il suit
      // la hauteur réelle du header et l'encoche iPhone.
      className={cn("border-t border-border/70 py-16 sm:py-24", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * FAQ de la landing : cinq questions, réponses issues de la FAQ générale.
 * Le même tableau alimente l'accordéon visible et le balisage FAQPage —
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
  const proof = proofHeading(content.proof.kind, testimonials.length >= 2);

  /** Chaque section sait se rendre — l'ordre, lui, vient du moteur. */
  const SECTIONS: Record<SectionKey, () => React.ReactNode> = {
    unify: () => (
      <Section id="decouvrir" track="unify">
        <SectionHead
          eyebrow="Le principe"
          title="Tout ce qui était éparpillé"
          keyword="retrouve sa place."
          description="Les loyers dans un tableur. Les baux dans les e-mails. Les factures dans plusieurs dossiers. Nireo rassemble chaque information au bon endroit."
        />
        <UnifyScene />
      </Section>
    ),

    features: () => (
      <Section id="fonctionnalites" track="features">
        <SectionHead
          eyebrow="Fonctionnalités"
          title="Trois choses que Nireo rend"
          keyword="plus simples."
        />
        <FeatureBlocks />
      </Section>
    ),

    proof: () => (
      <Section track="proof">
        <SectionHead eyebrow="Réassurance" title={proof.title} keyword={proof.keyword} />
        <ProofSection variant={content.proof.kind} testimonials={testimonials} />
      </Section>
    ),

    pricing: () => (
      <Section id="tarifs" track="pricing">
        <SectionHead
          eyebrow="Tarifs"
          title="Un plan pour chaque"
          keyword="taille de patrimoine."
          description="Démarrez gratuitement avec un logement, changez de plan quand votre patrimoine grandit."
        />
        <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
          <PricingSection
            compact
            emphasis={content.pricingEmphasis.plan}
            paymentsEnabled={isStripeConfigured}
          />
          {/* Bandeau compact : disparaît de lui-même si l'offre est terminée. */}
          <FounderOffer compact stripeEnabled={isStripeConfigured} />
        </div>
      </Section>
    ),

    faq: () => (
      <Section id="faq" track="faq">
        <SectionHead eyebrow="FAQ" title="Questions" keyword="fréquentes." />
        <div className="mt-8 sm:mt-10">
          <FaqSection items={FAQ_ITEMS} />
        </div>
        {/* Maillage interne : la page pilier et l'espace de contenu. */}
        <Reveal className="mx-auto mt-6 max-w-3xl text-center sm:mt-8">
          <p className="text-sm text-muted-foreground">
            Vous cherchez une explication plus complète ? Lisez la page{" "}
            <Link
              href={PILLAR_PAGE.path}
              className="text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
            >
              logiciel de gestion locative
            </Link>{" "}
            ou parcourez nos{" "}
            <Link
              href={RESOURCES_PAGE.path}
              className="text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
            >
              ressources
            </Link>
            .
          </p>
        </Reveal>
      </Section>
    ),
  };

  return (
    <>
      <JsonLd data={JSON_LD} />

      {/* Hero, entièrement piloté par le moteur de personnalisation */}
      <div data-lx-section="hero">
        <HeroCockpit
          headline={content.headline}
          subheadline={content.subheadline.text}
          cta={content.cta}
          media={content.media.kind}
        />
      </div>

      {/* Sections, dans l'ordre décidé par le moteur */}
      {content.sections.map((key) => (
        <Fragment key={key}>{SECTIONS[key]()}</Fragment>
      ))}

      {/* Final — Appel à l'action */}
      <section data-lx-section="cta" className="relative overflow-hidden border-t border-border/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="nireo-aurora absolute bottom-0 left-1/2 h-56 w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-[0.14] blur-2xl sm:h-80 sm:opacity-20" />
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[1.75rem] font-semibold text-balance text-foreground sm:text-4xl">
              {content.finalCta.lead} <span className="nireo-shine">{content.finalCta.highlight}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[0.98rem] text-muted-foreground sm:text-base">
              {content.finalCta.text}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:mt-7 sm:flex-row sm:gap-3">
              <Link
                href={content.cta.href}
                data-lx="final-cta-primary"
                data-lx-cta=""
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "nireo-glow nireo-sheen h-11 w-full px-6 text-[0.95rem] sm:w-auto"
                )}
              >
                {content.finalCta.primary} <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/connexion"
                data-lx="final-cta-login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "nireo-glass-soft h-11 w-full px-6 text-[0.95rem] text-foreground sm:w-auto"
                )}
              >
                Se connecter
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Mesure du comportement réel (anonyme, non bloquante). */}
      <LandingTracker />
    </>
  );
}
