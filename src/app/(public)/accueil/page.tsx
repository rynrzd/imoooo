import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Check,
  Clock,
  Compass,
  FileText,
  Layers,
  Receipt,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { LandingTracker } from "@/components/landing/landing-tracker";
import { ProofSection, proofHeading } from "@/components/landing/proof-section";
import { BeforeAfter } from "@/components/marketing/before-after";
import { DayTimeline } from "@/components/marketing/day-timeline";
import { FAQ_ITEMS, FaqSection } from "@/components/marketing/faq-section";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { HeroCockpit } from "@/components/marketing/hero-cockpit";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductDemo } from "@/components/marketing/product-demo";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { buttonVariants } from "@/components/ui/button";
import { getEngineState } from "@/lib/landing/config";
import { getLandingResolution } from "@/lib/landing/server";
import type { SectionKey } from "@/lib/landing/types";
import { PLANS } from "@/lib/stripe/plans";
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
 */

export const metadata: Metadata = {
  title: {
    absolute: "Nireo — Pilotez tout votre patrimoine immobilier depuis un seul endroit",
  },
  description:
    "Le centre de contrôle du patrimoine des propriétaires bailleurs : loyers, locataires, documents, dépenses et performances réunis dans un seul espace. Gratuit pour un premier logement, sans carte bancaire.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Nireo",
    locale: "fr_FR",
    title: "Nireo — Pilotez tout votre patrimoine immobilier depuis un seul endroit",
    description:
      "Loyers, locataires, documents, dépenses et performances réunis dans un espace conçu pour les propriétaires exigeants.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Nireo — Le centre de contrôle du patrimoine" }],
  },
};

/** La personnalisation lit les cookies : la page est rendue à chaque requête. */
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-medium tracking-widest text-primary uppercase">
      {children}
    </span>
  );
}

function SectionHead({
  n,
  eyebrow,
  title,
  keyword,
  description,
}: {
  n?: string;
  eyebrow: string;
  title: string;
  keyword?: string;
  description?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <div className="flex items-center justify-center gap-2.5">
        {n ? <span className="font-mono text-[11px] tracking-widest text-primary">N°{n}</span> : null}
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <h2 className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-[2.6rem]">
        {title} {keyword ? <span className="nireo-shine">{keyword}</span> : null}
      </h2>
      {description ? <p className="mt-4 text-base leading-relaxed text-balance text-muted-foreground">{description}</p> : null}
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
    <section id={id} data-lx-section={track} className={cn("scroll-mt-24 py-20 sm:py-28", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const TRUST = [
  { icon: ShieldCheck, label: "Données isolées par compte" },
  { icon: Smartphone, label: "Sur tous vos appareils" },
  { icon: Layers, label: "Hébergé en Europe" },
  { icon: Clock, label: "Sauvegarde automatique" },
  { icon: Check, label: "Sans carte bancaire" },
  { icon: Sparkles, label: "Interface soignée au détail" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Nireo", url: SITE_URL, inLanguage: "fr" },
    {
      "@type": "SoftwareApplication",
      name: "Nireo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "fr",
      url: SITE_URL,
      description:
        "Le centre de contrôle du patrimoine des propriétaires bailleurs : loyers, locataires, documents, dépenses et performances.",
      offers: PLANS.map((plan) => ({ "@type": "Offer", name: `Nireo ${plan.name}`, price: plan.monthlyPrice.toFixed(2), priceCurrency: "EUR" })),
    },
    { "@type": "FAQPage", mainEntity: FAQ_ITEMS.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })) },
  ],
};

/* ------------------------------------------------------------------ */

export default async function LandingPage() {
  const [{ content }, state] = await Promise.all([getLandingResolution(), getEngineState()]);
  const { videoUrl, testimonials } = state.capabilities;
  const proof = proofHeading(content.proof.kind, testimonials.length >= 2);

  /** Chaque section sait se rendre — l'ordre, lui, vient du moteur. */
  const SECTIONS: Record<SectionKey, (n: string) => React.ReactNode> = {
    trust: () => (
      <div
        data-lx-section="trust"
        className="relative overflow-hidden border-y border-border/70 py-5 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)] motion-reduce:[mask-image:none]"
      >
        <div className="flex w-max items-center gap-x-10 pr-10 [animation:nireo-marquee_38s_linear_infinite] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-3 motion-reduce:pr-0 motion-reduce:[animation:none]">
          {[...TRUST, ...TRUST].map((t, i) => (
            <span
              key={i}
              aria-hidden={i >= TRUST.length}
              className={cn(
                "flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm",
                i >= TRUST.length && "motion-reduce:hidden"
              )}
            >
              <t.icon className="size-4 text-primary" aria-hidden />
              {t.label}
            </span>
          ))}
        </div>
      </div>
    ),

    before_after: (n) => (
      <Section track="before_after" className="border-t border-border/70">
        <SectionHead
          n={n}
          eyebrow="Avant / Après"
          title="Du désordre au"
          keyword="contrôle total."
          description="Tableurs éparpillés, loyers oubliés, documents introuvables. Basculez pour voir ce que change Nireo."
        />
        <Reveal className="mt-12">
          <BeforeAfter />
        </Reveal>
      </Section>
    ),

    demo: (n) => (
      <Section id="demo" track="demo" className="border-t border-border/70">
        <SectionHead
          n={n}
          eyebrow="Démonstration"
          title="Explorez Nireo,"
          keyword="scénario par scénario."
          description="Choisissez ce que vous voulez voir : l'interface se recompose en direct, comme dans l'application."
        />
        <Reveal className="mt-12">
          <ProductDemo />
        </Reveal>
      </Section>
    ),

    features: (n) => (
      <Section id="fonctionnalites" track="features" className="border-t border-border/70">
        <SectionHead
          n={n}
          eyebrow="Fonctionnalités"
          title="Six modules,"
          keyword="une seule évidence."
          description="Chaque module a sa propre mise en scène — tous parlent le même langage."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SpotlightCard glow="var(--nireo-glow-a)" className="p-6 sm:col-span-2 lg:col-span-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-primary"><Banknote className="size-5" /></span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Gestion des loyers</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Échéances générées chaque mois, encaissements, impayés et relances — suivis automatiquement.
                </p>
              </div>
              <span className="hidden shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary sm:block">96 % encaissé</span>
            </div>
            <div className="mt-5 grid grid-cols-12 gap-1.5" aria-hidden>
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className={cn("h-6 rounded-md", [3, 7, 12, 18, 21].includes(i) ? "bg-primary/70" : [1, 9, 15].includes(i) ? "bg-amber-400/40" : "bg-muted")} />
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard glow="oklch(0.82 0.09 60)" className="p-6 sm:col-span-2">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-amber-300"><Bell className="size-5" /></span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Notifications</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Retards, documents qui expirent, chantiers dépassés : prévenu au bon moment.</p>
            <div className="mt-4 space-y-2">
              {["Loyer en retard · Studio", "Assurance à renouveler"].map((notice) => (
                <div key={notice} className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-[11px] text-foreground">
                  <span className="size-1.5 rounded-full bg-amber-400" /> {notice}
                </div>
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard glow="var(--nireo-glow-c)" className="p-6 sm:col-span-2">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-primary"><FileText className="size-5" /></span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Documents</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Baux, diagnostics, factures — rangés automatiquement par logement.</p>
            <div className="mt-4 space-y-1.5">
              {["Bail — T3 Tête d’Or", "DPE — T4", "Facture chaudière"].map((d) => (
                <div key={d} className="flex items-center gap-2 text-[11px] text-muted-foreground"><FileText className="size-3.5 text-primary/70" /> {d}</div>
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard glow="var(--nireo-glow-b)" className="p-6 sm:col-span-2">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-primary"><Building2 className="size-5" /></span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Patrimoine</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Une vue globale de tous vos biens et de leur statut.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[{ g: "from-primary/30 to-primary/10" }, { g: "from-teal-500/25 to-primary/10" }].map((p, i) => (
                <div key={i} className={cn("h-12 rounded-lg bg-gradient-to-br", p.g)} />
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard glow="oklch(0.82 0.09 60)" className="p-6 sm:col-span-2">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-amber-300"><Receipt className="size-5" /></span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Dépenses &amp; travaux</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Catégorisées, reliées aux chantiers et à la comptabilité.</p>
            <div className="mt-4 space-y-2">
              {[["Travaux", 62], ["Charges", 40], ["Assurance", 24]].map(([l, v]) => (
                <div key={l as string}>
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>{l}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard glow="var(--nireo-glow-c)" className="p-6 sm:col-span-2 lg:col-span-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-md">
                <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-primary"><BarChart3 className="size-5" /></span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Statistiques &amp; performances</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Revenus, dépenses, résultat net, rendement et taux d’occupation, calculés en continu sur vos vraies données.
                </p>
              </div>
              <div className="flex h-28 items-end gap-1.5 sm:w-1/2" aria-hidden>
                {[38, 52, 46, 63, 57, 71, 66, 79, 74, 86, 81, 94].map((h, i) => (
                  <span key={i} className={cn("flex-1 rounded-t-[3px]", i === 11 ? "bg-gradient-to-t from-primary/50 to-primary" : "bg-muted")} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </SpotlightCard>
        </div>
      </Section>
    ),

    day: (n) => (
      <Section id="comment-ca-marche" track="day" className="border-t border-border/70">
        <SectionHead n={n} eyebrow="Le quotidien" title="Une journée" keyword="avec Nireo." description="Le produit travaille pour vous, du matin au soir." />
        <Reveal className="mt-12">
          <DayTimeline />
        </Reveal>
      </Section>
    ),

    proof: (n) => (
      <Section track="proof" className="border-t border-border/70">
        <SectionHead
          n={n}
          eyebrow={proof.eyebrow}
          title={proof.title}
          keyword={proof.keyword}
          description="Aucun chiffre client inventé : uniquement ce que le produit fait vraiment."
        />
        <ProofSection variant={content.proof.kind} testimonials={testimonials} />
      </Section>
    ),

    pricing: (n) => (
      <Section id="tarifs" track="pricing" className="border-t border-border/70">
        <SectionHead n={n} eyebrow="Tarifs" title="Un plan pour chaque" keyword="taille de patrimoine." description="Démarrez gratuitement avec un logement, montez en gamme quand votre patrimoine grandit." />
        <div className="mt-14 space-y-10">
          {content.pricingEmphasis.plan === "founder" ? (
            <FounderOffer stripeEnabled={isStripeConfigured} />
          ) : null}
          <PricingSection emphasis={content.pricingEmphasis.plan} />
          {content.pricingEmphasis.plan === "founder" ? null : (
            <FounderOffer stripeEnabled={isStripeConfigured} />
          )}
        </div>
      </Section>
    ),

    company: (n) => (
      <Section track="company" className="border-t border-border/70">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] tracking-widest text-primary">N°{n}</span>
              <Eyebrow>L’entreprise</Eyebrow>
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-[2.5rem]">
              Nous construisons le futur de la <span className="nireo-shine">gestion locative.</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Nireo est né d’un constat simple : gérer un patrimoine ne devrait pas rimer avec paperasse et stress.
              Nous bâtissons l’outil que nous aurions voulu avoir — clair, rigoureux et élégant.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: Compass, t: "Notre vision", d: "Devenir la référence de la gestion locative pour les propriétaires exigeants." },
                { icon: Rocket, t: "Notre mission", d: "Rendre à chacun le contrôle et la sérénité sur son patrimoine, sans complexité." },
              ].map((r) => (
                <div key={r.t} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><r.icon className="size-4.5" /></span>
                  <div><p className="text-sm font-semibold text-foreground">{r.t}</p><p className="text-sm text-muted-foreground">{r.d}</p></div>
                </div>
              ))}
            </div>
            <Link
              href="/a-propos"
              data-lx="company-link"
              className={cn(buttonVariants({ variant: "outline" }), "nireo-glass-soft mt-8 text-foreground")}
            >
              Découvrir l’entreprise <ArrowRight className="size-4" />
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <div className="nireo-glass nireo-hairline rounded-3xl p-6">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Sparkles, t: "Innovation", d: "Les meilleures technologies du web." },
                  { icon: ShieldCheck, t: "Confiance", d: "Vos données, protégées et isolées." },
                  { icon: Rocket, t: "Ambition", d: "Un produit pensé pour durer." },
                  { icon: Check, t: "Exigence", d: "Le soin du détail, partout." },
                ].map((c) => (
                  <div key={c.t} className="rounded-2xl border border-border bg-card p-4">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary"><c.icon className="size-4.5" /></span>
                    <p className="mt-3 text-sm font-semibold text-foreground">{c.t}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{c.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    ),

    faq: (n) => (
      <Section id="faq" track="faq" className="border-t border-border/70">
        <SectionHead n={n} eyebrow="FAQ" title="Questions" keyword="fréquentes." description="Les réponses correspondent aux fonctions réellement disponibles dans l’application." />
        <div className="mt-12"><FaqSection /></div>
      </Section>
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* 1 — Hero, entièrement piloté par le moteur de personnalisation */}
      <div data-lx-section="hero">
        <HeroCockpit
          headline={content.headline}
          subheadline={content.subheadline.text}
          cta={content.cta}
          media={content.media.kind}
          videoUrl={videoUrl}
        />
      </div>

      {/* 2…n — Sections, dans l'ordre décidé par le moteur */}
      {content.sections.map((key, index) => (
        <Fragment key={key}>{SECTIONS[key](String(index + 2).padStart(2, "0"))}</Fragment>
      ))}

      {/* Final — Appel à l'action */}
      <section data-lx-section="cta" className="relative overflow-hidden border-t border-border/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="nireo-aurora absolute bottom-0 left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-30 blur-2xl" />
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <div className="mx-auto mb-8 flex w-fit items-center gap-1.5" aria-hidden>
              {[Building2, Banknote, FileText, BarChart3].map((Icon, i) => (
                <span key={i} className="nireo-glass grid size-11 place-items-center rounded-2xl text-primary" style={{ animation: "nireo-rise 0.7s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${i * 90}ms` }}>
                  <Icon className="size-5" />
                </span>
              ))}
            </div>
            <h2 className="mx-auto max-w-2xl text-4xl font-semibold text-balance text-foreground sm:text-5xl">
              {content.finalCta.lead} <span className="nireo-shine">{content.finalCta.highlight}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">{content.finalCta.text}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={content.cta.href}
                data-lx="final-cta-primary"
                data-lx-cta=""
                className={cn(buttonVariants({ size: "lg" }), "nireo-glow nireo-sheen h-11 w-full px-6 text-[0.95rem] sm:w-auto")}
              >
                {content.finalCta.primary} <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/connexion"
                data-lx="final-cta-login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "nireo-glass-soft h-11 w-full px-6 text-[0.95rem] text-foreground sm:w-auto")}
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
