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
import { BeforeAfter } from "@/components/marketing/before-after";
import { CountUp } from "@/components/marketing/count-up";
import { DayTimeline } from "@/components/marketing/day-timeline";
import { FAQ_ITEMS, FaqSection } from "@/components/marketing/faq-section";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { HeroCockpit } from "@/components/marketing/hero-cockpit";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductDemo } from "@/components/marketing/product-demo";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { buttonVariants } from "@/components/ui/button";
import { PLANS } from "@/lib/stripe/plans";
import { isStripeConfigured } from "@/lib/stripe/config";
import { SITE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

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

function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 sm:py-28", className)}>
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

const STATS = [
  { value: 6, suffix: "", label: "modules réunis dans un seul espace" },
  { value: 1, suffix: "", label: "logement suivi gratuitement, à vie" },
  { value: 100, suffix: " %", label: "de vos données isolées de tout autre compte" },
  { value: 24, suffix: "/7", label: "accès à votre patrimoine, partout" },
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

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* 1 — Hero cinématographique */}
      <HeroCockpit />

      {/* Barre de confiance — défilement continu (marquee), statique en reduced-motion */}
      <div className="relative overflow-hidden border-y border-border/70 py-5 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)] motion-reduce:[mask-image:none]">
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

      {/* 2+6 — Avant / Après (le chaos → l'ordre) */}
      <Section>
        <SectionHead
          n="02"
          eyebrow="Avant / Après"
          title="Du désordre au"
          keyword="contrôle total."
          description="Tableurs éparpillés, loyers oubliés, documents introuvables. Basculez pour voir ce que change Nireo."
        />
        <Reveal className="mt-12">
          <BeforeAfter />
        </Reveal>
      </Section>

      {/* 3 — Démonstration interactive */}
      <Section id="demo" className="border-t border-border/70">
        <SectionHead
          n="03"
          eyebrow="Démonstration"
          title="Explorez Nireo,"
          keyword="scénario par scénario."
          description="Choisissez ce que vous voulez voir : l'interface se recompose en direct, comme dans l'application."
        />
        <Reveal className="mt-12">
          <ProductDemo />
        </Reveal>
      </Section>

      {/* 4 — Fonctionnalités éditoriales (bento) */}
      <Section id="fonctionnalites" className="border-t border-border/70">
        <SectionHead
          n="04"
          eyebrow="Fonctionnalités"
          title="Six modules,"
          keyword="une seule évidence."
          description="Chaque module a sa propre mise en scène — tous parlent le même langage."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Loyers — grand */}
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
                <span key={i} className={cn("h-6 rounded-md", [3, 7, 12, 18, 21].includes(i) ? "bg-primary/70" : [1, 9, 15].includes(i) ? "bg-amber-500/40" : "bg-muted")} />
              ))}
            </div>
          </SpotlightCard>

          {/* Notifications — petit */}
          <SpotlightCard glow="oklch(0.82 0.09 60)" className="p-6 sm:col-span-2">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-amber-600"><Bell className="size-5" /></span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Notifications</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Retards, documents qui expirent, chantiers dépassés : prévenu au bon moment.</p>
            <div className="mt-4 space-y-2">
              {["Loyer en retard · Studio", "Assurance à renouveler"].map((n) => (
                <div key={n} className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-[11px] text-foreground">
                  <span className="size-1.5 rounded-full bg-amber-500" /> {n}
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Documents */}
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

          {/* Patrimoine */}
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

          {/* Dépenses & travaux */}
          <SpotlightCard glow="oklch(0.82 0.09 60)" className="p-6 sm:col-span-2">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-amber-600"><Receipt className="size-5" /></span>
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

          {/* Statistiques — pleine largeur */}
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

      {/* 5 — Une journée avec Nireo */}
      <Section id="comment-ca-marche" className="border-t border-border/70">
        <SectionHead n="05" eyebrow="Le quotidien" title="Une journée" keyword="avec Nireo." description="Le produit travaille pour vous, du matin au soir." />
        <Reveal className="mt-12">
          <DayTimeline />
        </Reveal>
      </Section>

      {/* 7 — Chiffres & crédibilité */}
      <Section className="border-t border-border/70">
        <SectionHead n="07" eyebrow="Ce que Nireo garantit" title="Des bénéfices" keyword="concrets." description="Pas de faux chiffres clients : uniquement ce que le produit fait vraiment." />
        <Reveal className="mt-12">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  <span className="nireo-shine"><CountUp value={s.value} suffix={s.suffix} /></span>
                </p>
                <p className="mx-auto mt-3 max-w-[16ch] text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* 8 — Tarifs */}
      <Section id="tarifs" className="border-t border-border/70">
        <SectionHead n="08" eyebrow="Tarifs" title="Un plan pour chaque" keyword="taille de patrimoine." description="Démarrez gratuitement avec un logement, montez en gamme quand votre patrimoine grandit." />
        <div className="mt-14 space-y-10">
          <FounderOffer stripeEnabled={isStripeConfigured} />
          <PricingSection />
        </div>
      </Section>

      {/* 9 — Présentation de Nireo */}
      <Section className="border-t border-border/70">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>L’entreprise</Eyebrow>
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
            <Link href="/a-propos" className={cn(buttonVariants({ variant: "outline" }), "nireo-glass-soft mt-8 text-foreground")}>
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

      {/* 10a — FAQ */}
      <Section id="faq" className="border-t border-border/70">
        <SectionHead n="10" eyebrow="FAQ" title="Questions" keyword="fréquentes." description="Les réponses correspondent aux fonctions réellement disponibles dans l’application." />
        <div className="mt-12"><FaqSection /></div>
      </Section>

      {/* 10b — CTA final cinématographique */}
      <section className="relative overflow-hidden border-t border-border/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="nireo-aurora absolute bottom-0 left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-30 blur-2xl" />
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            {/* Le patrimoine qui se rassemble */}
            <div className="mx-auto mb-8 flex w-fit items-center gap-1.5" aria-hidden>
              {[Building2, Banknote, FileText, BarChart3].map((Icon, i) => (
                <span key={i} className="nireo-glass grid size-11 place-items-center rounded-2xl text-primary" style={{ animation: "nireo-rise 0.7s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${i * 90}ms` }}>
                  <Icon className="size-5" />
                </span>
              ))}
            </div>
            <h2 className="mx-auto max-w-2xl text-4xl font-semibold text-balance text-foreground sm:text-5xl">
              Votre patrimoine mérite mieux que{" "}
              <span className="nireo-shine">des fichiers dispersés.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
              Créez votre espace en une minute, ajoutez votre premier logement, et reprenez le contrôle.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/inscription" className={cn(buttonVariants({ size: "lg" }), "nireo-glow nireo-sheen h-11 w-full px-6 text-[0.95rem] sm:w-auto")}>
                Créer mon espace Nireo <ArrowRight className="size-4" />
              </Link>
              <Link href="/connexion" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "nireo-glass-soft h-11 w-full px-6 text-[0.95rem] text-foreground sm:w-auto")}>
                Se connecter
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
