import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  Clock,
  CreditCard,
  FileText,
  FileWarning,
  Gauge,
  Hammer,
  ImageOff,
  Layers,
  LineChart,
  Lock,
  Receipt,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { DemoShowcase } from "@/components/marketing/demo-showcase";
import { FAQ_ITEMS, FaqSection } from "@/components/marketing/faq-section";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { HeroScene } from "@/components/marketing/hero-scene";
import { CountUp } from "@/components/marketing/count-up";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { buttonVariants } from "@/components/ui/button";
import { PLANS } from "@/lib/stripe/plans";
import { isStripeConfigured } from "@/lib/stripe/config";
import { SITE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    absolute:
      "Nireo — Gérez tout votre patrimoine immobilier depuis une seule plateforme",
  },
  description:
    "Le logiciel de gestion locative des propriétaires bailleurs : logements, locataires, loyers automatiques, documents, travaux et statistiques. Gratuit pour un premier logement, sans carte bancaire.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Nireo",
    locale: "fr_FR",
    title: "Nireo — Gérez tout votre patrimoine immobilier depuis une seule plateforme",
    description:
      "Logements, locataires, loyers automatiques, documents, travaux et statistiques : un seul espace, conçu pour les propriétaires bailleurs.",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Nireo — Le logiciel de gestion locative des propriétaires bailleurs",
      },
    ],
  },
};

/* ================================================================== */
/*  Blocs réutilisables                                                */
/* ================================================================== */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-widest text-primary uppercase">
      {children}
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
  keyword,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  keyword?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-[2.6rem]">
        {title}{" "}
        {keyword ? <span className="nireo-shine">{keyword}</span> : null}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-balance text-muted-foreground">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 sm:py-28", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

/* ================================================================== */
/*  Contenus                                                           */
/* ================================================================== */

const TRUST_BAR = [
  { icon: ShieldCheck, label: "Données isolées par compte" },
  { icon: Lock, label: "Stockage privé chiffré" },
  { icon: Layers, label: "Hébergé en Europe" },
  { icon: Clock, label: "Sauvegarde automatique" },
];

const PAINS = [
  { icon: FileWarning, text: "Baux, diagnostics et factures éparpillés entre disque dur, e-mails et papier." },
  { icon: Wallet, text: "Loyers en retard repérés trop tard, relances oubliées." },
  { icon: ImageOff, text: "Photos d’état des lieux noyées dans la galerie du téléphone." },
  { icon: Gauge, text: "Rentabilité réelle impossible à suivre dans un tableur." },
];

const CHAOS = [
  { label: "loyers_2026_v3.xlsx", icon: Receipt, top: "6%", left: "4%", rot: "-8deg" },
  { label: "IMG_2381.jpg", icon: ImageOff, top: "2%", left: "58%", rot: "6deg" },
  { label: "Relancer M. Durand", icon: StickyNote, top: "44%", left: "0%", rot: "-4deg" },
  { label: "bail_signé(final).pdf", icon: FileText, top: "40%", left: "52%", rot: "5deg" },
  { label: "Assurance PNO ?", icon: FileWarning, top: "72%", left: "22%", rot: "-6deg" },
];

const PILLARS = [
  { icon: Building2, label: "Logements" },
  { icon: Users, label: "Locataires" },
  { icon: Wallet, label: "Loyers" },
  { icon: FileText, label: "Documents" },
  { icon: Hammer, label: "Travaux" },
  { icon: LineChart, label: "Statistiques" },
];

type Module = {
  icon: typeof Building2;
  title: string;
  text: string;
  glow: string;
  tint: string;
  featured?: boolean;
  kind?: "rents" | "stats";
};

const MODULES: Module[] = [
  {
    icon: Wallet,
    title: "Loyers automatiques",
    text: "Les échéances se génèrent chaque mois. Encaissé, en attente, en retard ou partiel : tout est suivi, rien n’est oublié.",
    glow: "var(--nireo-glow-a)",
    tint: "text-primary",
    featured: true,
    kind: "rents",
  },
  {
    icon: LineChart,
    title: "Statistiques réelles",
    text: "Revenus, dépenses, résultat net, taux d’occupation et rendement — calculés en continu sur vos vraies données.",
    glow: "var(--nireo-glow-c)",
    tint: "text-sky-300",
    featured: true,
    kind: "stats",
  },
  {
    icon: Building2,
    title: "Logements",
    text: "Chaque bien avec son prix, son loyer et son statut — loué, vacant ou en travaux.",
    glow: "var(--nireo-glow-a)",
    tint: "text-primary",
  },
  {
    icon: Users,
    title: "Locataires",
    text: "Bail, dates d’entrée et de sortie, charges et dépôt de garantie : carré et retrouvable.",
    glow: "var(--nireo-glow-b)",
    tint: "text-violet-300",
  },
  {
    icon: FileText,
    title: "Documents",
    text: "Baux, diagnostics, assurances et factures classés par logement dans un espace privé.",
    glow: "var(--nireo-glow-c)",
    tint: "text-sky-300",
  },
  {
    icon: Hammer,
    title: "Travaux",
    text: "Chaque chantier suivi avec budget, avancement et coût réel, relié à vos dépenses.",
    glow: "oklch(0.82 0.09 60)",
    tint: "text-amber-300",
  },
  {
    icon: Bell,
    title: "Notifications",
    text: "Loyers en retard, documents qui expirent, chantiers dépassés : prévenu au bon moment.",
    glow: "oklch(0.82 0.09 60)",
    tint: "text-amber-300",
  },
  {
    icon: CreditCard,
    title: "Abonnements",
    text: "Démarrez gratuitement, montez en gamme quand le patrimoine grandit — sans engagement.",
    glow: "var(--nireo-glow-b)",
    tint: "text-violet-300",
  },
];

const STEPS = [
  { step: "01", title: "Créez votre compte", text: "Gratuit, sans carte bancaire. Votre espace est prêt en une minute." },
  { step: "02", title: "Ajoutez un logement", text: "Adresse, surface, loyer, statut : le bien est prêt en deux minutes." },
  { step: "03", title: "Ajoutez un locataire", text: "Le bail, le dépôt et les dates rejoignent le dossier du bien." },
  { step: "04", title: "Pilotez, sereinement", text: "Les échéances se créent seules ; le tableau de bord fait les comptes." },
];

const DIFFERENTIATORS = [
  { icon: Sparkles, title: "Simplicité", text: "Une interface épurée, pensée pour aller à l’essentiel. Aucune formation nécessaire.", glow: "var(--nireo-glow-b)" },
  { icon: Clock, title: "Temps gagné", text: "Les loyers, calculs et rappels se font tout seuls. Vous récupérez vos week-ends.", glow: "var(--nireo-glow-a)" },
  { icon: ShieldCheck, title: "Sécurité", text: "Données isolées par compte, stockage privé, liens signés à durée limitée.", glow: "var(--nireo-glow-c)" },
  { icon: Gauge, title: "Maîtrise", text: "Une vision claire et à jour de chaque bien. Vous décidez, chiffres en main.", glow: "oklch(0.82 0.09 60)" },
];

const COMPARISON = [
  { label: "Suivi des loyers", excel: "Formules manuelles, oublis fréquents", nireo: "Échéances générées automatiquement" },
  { label: "Impayés", excel: "À repérer soi-même dans le tableau", nireo: "Retards détectés et signalés" },
  { label: "Documents", excel: "Dispersés entre disque dur et e-mails", nireo: "Classés par logement, stockage privé" },
  { label: "États des lieux", excel: "Photos mélangées dans la galerie", nireo: "Datées, classées, comparables" },
  { label: "Rentabilité", excel: "Calculs approximatifs, rarement à jour", nireo: "Résultat net et rendement en continu" },
  { label: "Accès", excel: "Un fichier, un seul ordinateur", nireo: "Partout : ordinateur, tablette, mobile" },
];

const STATS = [
  { value: 8, suffix: "", label: "modules réunis dans un seul espace" },
  { value: 2, suffix: " min", label: "pour ajouter votre premier logement" },
  { value: 100, suffix: " %", label: "de vos données isolées de tout autre compte" },
  { value: 1, suffix: "", label: "logement suivi gratuitement, à vie" },
];

const SECURITY = [
  { icon: Lock, title: "Comptes protégés", text: "Connexion par e-mail confirmée, sessions sécurisées, routes privées inaccessibles sans authentification." },
  { icon: ShieldCheck, title: "Données cloisonnées", text: "Chaque ligne vous appartient explicitement : un compte ne peut jamais lire les données d’un autre." },
  { icon: FileText, title: "Fichiers privés", text: "Documents et photos conservés dans un espace privé, servis par des liens signés à durée limitée." },
];

/* ================================================================== */
/*  Données structurées (Schema.org)                                   */
/* ================================================================== */

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
        "Logiciel de gestion locative pour propriétaires bailleurs : logements, locataires, loyers automatiques, documents, travaux et statistiques.",
      offers: PLANS.map((plan) => ({
        "@type": "Offer",
        name: `Nireo ${plan.name}`,
        price: plan.monthlyPrice.toFixed(2),
        priceCurrency: "EUR",
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ---------------- Hero ---------------- */}
      <HeroScene />

      {/* ---------------- Barre de confiance ---------------- */}
      <div className="relative border-y border-white/5">
        <ul className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 sm:px-6">
          {TRUST_BAR.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm"
            >
              <item.icon className="size-4 text-primary" aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {/* ---------------- Le problème ---------------- */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>Le problème</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-[2.5rem]">
              Un patrimoine dispersé coûte du temps, de l’argent et du calme.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Tableur qui se désynchronise, dossiers éparpillés, rappels de tête.
              Plus le patrimoine grandit, plus chaque oubli se paie.
            </p>
            <ul className="mt-8 space-y-3">
              {PAINS.map((pain) => (
                <li key={pain.text} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-muted-foreground">
                    <pain.icon className="size-3.5" />
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {pain.text}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Nuage de chaos — chips ternes, désordonnées, penchées. */}
          <Reveal delay={120}>
            <div className="relative h-80 select-none sm:h-96" aria-hidden>
              <div className="absolute inset-0 rounded-3xl border border-white/5 bg-white/[0.015]" />
              {CHAOS.map((c) => (
                <div
                  key={c.label}
                  className="absolute flex items-center gap-2 rounded-xl border border-white/8 bg-[oklch(0.22_0.01_264)] px-3 py-2 opacity-70 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] grayscale"
                  style={{ top: c.top, left: c.left, rotate: c.rot }}
                >
                  <c.icon className="size-4 text-muted-foreground/70" />
                  <span className="text-xs text-muted-foreground/80">{c.label}</span>
                </div>
              ))}
              <div className="absolute right-4 bottom-4 flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-[11px] font-medium text-destructive">
                <X className="size-3.5" /> 3 loyers non pointés
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ---------------- La solution ---------------- */}
      <Section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(50%_100%_at_50%_0%,var(--nireo-glow-a),transparent_70%)] opacity-20 blur-xl"
        />
        <SectionHead
          eyebrow="La solution"
          title="Nireo réunit tout. À jour,"
          keyword="en permanence."
          description="Un seul espace, vivant, où chaque bien devient un dossier clair. Fini les tableurs qui se contredisent."
        />
        <Reveal className="mt-14" delay={80}>
          <div className="nireo-glass nireo-hairline mx-auto max-w-3xl rounded-3xl p-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PILLARS.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.02] p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <p.icon className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ---------------- Démonstration ---------------- */}
      <Section id="demo" className="border-t border-white/5">
        <SectionHead
          eyebrow="Démonstration"
          title="Nireo"
          keyword="en mouvement."
          description="Des aperçus composés avec les vrais éléments d’interface de l’application — passez d’un écran à l’autre."
        />
        <Reveal className="mt-14">
          <DemoShowcase />
        </Reveal>
      </Section>

      {/* ---------------- Fonctionnalités (bento) ---------------- */}
      <Section id="fonctionnalites" className="border-t border-white/5">
        <SectionHead
          eyebrow="Fonctionnalités"
          title="Huit modules,"
          keyword="un seul espace."
          description="Chacun avec sa propre identité — mais tous parfaitement coordonnés."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {MODULES.map((m, i) => (
            <Reveal
              key={m.title}
              delay={(i % 3) * 70}
              className={cn(
                m.featured ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-2"
              )}
            >
              <SpotlightCard glow={m.glow} className="h-full p-6">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-xl border border-white/8 bg-white/[0.04]",
                    m.tint
                  )}
                >
                  <m.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.text}</p>

                {m.kind === "rents" ? (
                  <div className="mt-5 space-y-2">
                    {[
                      { name: "T3 Tête d’Or", amount: "980 €", state: "Encaissé", color: "text-emerald-300", dot: "bg-emerald-400" },
                      { name: "Studio Croix-Rousse", amount: "560 €", state: "En attente", color: "text-amber-300", dot: "bg-amber-400" },
                      { name: "T2 Part-Dieu", amount: "840 €", state: "En retard", color: "text-rose-300", dot: "bg-rose-400" },
                    ].map((r) => (
                      <div
                        key={r.name}
                        className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2"
                      >
                        <span className={cn("size-1.5 rounded-full", r.dot)} />
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{r.name}</span>
                        <span className="text-xs font-medium text-foreground">{r.amount}</span>
                        <span className={cn("text-[11px]", r.color)}>{r.state}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {m.kind === "stats" ? (
                  <div className="mt-5 flex h-24 items-end gap-1.5" aria-hidden>
                    {[46, 60, 54, 68, 63, 76, 71, 84, 80, 92].map((h, j) => (
                      <span
                        key={j}
                        className={cn(
                          "flex-1 rounded-t-[3px]",
                          j === 9 ? "bg-gradient-to-t from-sky-400/50 to-sky-300" : "bg-white/10"
                        )}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                ) : null}
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- Comment ça marche ---------------- */}
      <Section id="comment-ca-marche" className="border-t border-white/5">
        <SectionHead
          eyebrow="Comment ça marche"
          title="Opérationnel en"
          keyword="quatre étapes."
        />
        <div className="relative mt-14">
          {/* Connecteur */}
          <div
            aria-hidden
            className="absolute top-9 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 90}>
                <div className="relative h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center">
                  <span className="relative mx-auto grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 text-base font-semibold text-foreground ring-1 ring-white/10">
                    {s.step}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------- Pourquoi Nireo est différent ---------------- */}
      <Section className="border-t border-white/5">
        <SectionHead
          eyebrow="Pourquoi Nireo"
          title="Le tableur a fait son temps."
          keyword="Place à la maîtrise."
          description="Ce qui distingue Nireo : moins d’efforts, plus de clarté, une vraie tranquillité."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFERENTIATORS.map((d, i) => (
            <Reveal key={d.title} delay={(i % 4) * 70}>
              <SpotlightCard glow={d.glow} className="h-full p-6">
                <span className="grid size-11 place-items-center rounded-xl border border-white/8 bg-white/[0.04] text-primary">
                  <d.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.text}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        {/* Comparaison Excel vs Nireo */}
        <Reveal className="mt-8">
          <div className="nireo-glass overflow-hidden rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="p-4 text-left text-[11px] font-medium tracking-wider text-muted-foreground uppercase">&nbsp;</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Le tableur</th>
                    <th className="bg-primary/[0.06] p-4 text-left text-sm font-semibold text-primary">
                      Nireo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-white/6 last:border-0">
                      <th scope="row" className="p-4 text-left text-sm font-medium text-foreground">
                        {row.label}
                      </th>
                      <td className="p-4 text-muted-foreground">
                        <span className="flex items-start gap-2">
                          <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                          {row.excel}
                        </span>
                      </td>
                      <td className="bg-primary/[0.04] p-4 text-foreground">
                        <span className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          {row.nireo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ---------------- Chiffres ---------------- */}
      <Section className="border-t border-white/5">
        <Reveal>
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  <span className="nireo-shine">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </span>
                </p>
                <p className="mx-auto mt-3 max-w-[16ch] text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ---------------- Sécurité ---------------- */}
      <Section className="border-t border-white/5">
        <SectionHead
          eyebrow="Sécurité"
          title="Vos données"
          keyword="restent les vôtres."
          description="Pas de grandes promesses : uniquement ce que l’application fait réellement, dès aujourd’hui."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {SECURITY.map((point, i) => (
            <Reveal key={point.title} delay={i * 90}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                <span className="grid size-11 place-items-center rounded-xl border border-white/8 bg-white/[0.04] text-primary">
                  <point.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- Tarifs ---------------- */}
      <Section id="tarifs" className="border-t border-white/5">
        <SectionHead
          eyebrow="Tarifs"
          title="Un plan pour chaque"
          keyword="taille de patrimoine."
          description="Démarrez gratuitement avec un logement, montez en gamme quand votre patrimoine grandit."
        />
        <div className="mt-14 space-y-10">
          <FounderOffer stripeEnabled={isStripeConfigured} />
          <PricingSection />
        </div>
      </Section>

      {/* ---------------- FAQ ---------------- */}
      <Section id="faq" className="border-t border-white/5">
        <SectionHead
          eyebrow="FAQ"
          title="Questions"
          keyword="fréquentes."
          description="Les réponses correspondent aux fonctions réellement disponibles dans l’application."
        />
        <div className="mt-14">
          <FaqSection />
        </div>
      </Section>

      {/* ---------------- CTA final ---------------- */}
      <section className="relative overflow-hidden border-t border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_50%_100%,var(--nireo-glow-a),transparent_65%)] opacity-25"
        />
        <div className="mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <div className="nireo-glass-soft mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-foreground/80">
              <Sparkles className="size-3.5 text-primary" />
              Prêt en une minute
            </div>
            <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold text-balance text-foreground sm:text-5xl">
              Reprenez le contrôle de votre patrimoine{" "}
              <span className="nireo-shine">dès aujourd’hui.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
              Créez votre compte gratuitement, ajoutez votre premier logement et
              retrouvez enfin tout au même endroit.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/inscription"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "nireo-glow h-11 w-full px-6 text-[0.95rem] sm:w-auto"
                )}
              >
                Créer mon compte gratuitement
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/connexion"
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
    </>
  );
}
