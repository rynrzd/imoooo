import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  CloudUpload,
  CreditCard,
  Database,
  FileText,
  Globe,
  Hammer,
  HeartHandshake,
  Home,
  Landmark,
  LineChart,
  Lock,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { DemoShowcase } from "@/components/marketing/demo-showcase";
import { FAQ_ITEMS, FaqSection } from "@/components/marketing/faq-section";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { DashboardPreview } from "@/components/marketing/product-previews";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { PLANS } from "@/lib/stripe/plans";
import { isStripeConfigured } from "@/lib/stripe/config";
import { SITE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  // Servie sur « / » pour les visiteurs (réécriture du proxy).
  title: "ImmoPilot — Gérez tout votre patrimoine immobilier depuis une seule plateforme",
  description:
    "Le logiciel de gestion locative des propriétaires bailleurs : logements, locataires, loyers automatiques, documents, travaux et statistiques. Gratuit pour un premier logement, sans carte bancaire.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ImmoPilot — Gérez tout votre patrimoine immobilier depuis une seule plateforme",
    description:
      "Logements, locataires, loyers automatiques, documents, travaux et statistiques : un seul espace, conçu pour les propriétaires bailleurs.",
    url: "/",
  },
};

/* ------------------------------------------------------------------ */
/* Blocs de section                                                    */
/* ------------------------------------------------------------------ */

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-20", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          {eyebrow ? (
            <p className="text-xs font-medium tracking-widest text-primary uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </Reveal>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Contenus                                                            */
/* ------------------------------------------------------------------ */

const TRUST_BAR = [
  { icon: ShieldCheck, label: "Données sécurisées" },
  { icon: Globe, label: "Hébergé en Europe" },
  { icon: CloudUpload, label: "Sauvegarde automatique" },
  { icon: Lock, label: "Authentification sécurisée" },
  { icon: Database, label: "Propulsé par Supabase" },
];

const MODULES = [
  {
    icon: Building2,
    title: "Logements",
    text: "Chaque bien avec ses caractéristiques, son prix d'achat, son loyer et son statut — loué, vacant ou en travaux.",
  },
  {
    icon: Users,
    title: "Locataires",
    text: "Locataire, bail, dates d'entrée et de sortie, loyer, charges et dépôt de garantie : tout est carré et retrouvable.",
  },
  {
    icon: Wallet,
    title: "Loyers",
    text: "Les échéances se génèrent automatiquement chaque mois : encaissé, en attente, en retard ou partiel.",
  },
  {
    icon: FileText,
    title: "Documents",
    text: "Baux, diagnostics, assurances, factures et photos datées, classés par logement dans un stockage privé.",
  },
  {
    icon: Hammer,
    title: "Travaux",
    text: "Chaque chantier suivi avec budget, avancement et coût réel, relié automatiquement à vos dépenses.",
  },
  {
    icon: LineChart,
    title: "Statistiques",
    text: "Revenus, dépenses, résultat net, taux d'occupation et rendement — calculés sur vos vraies données.",
  },
  {
    icon: Bell,
    title: "Notifications",
    text: "Loyers en retard, documents qui expirent, chantiers dépassés : l'application vous prévient au bon moment.",
  },
  {
    icon: CreditCard,
    title: "Abonnements",
    text: "Démarrez gratuitement, montez en gamme quand votre patrimoine grandit — sans engagement, sans migration.",
  },
];

const STEPS = [
  { step: "1", title: "Créez votre compte", text: "Gratuit, sans carte bancaire : votre espace est prêt en une minute." },
  { step: "2", title: "Ajoutez votre premier logement", text: "Adresse, surface, loyer, statut : le bien est prêt en deux minutes." },
  { step: "3", title: "Ajoutez un locataire", text: "Le bail, le dépôt de garantie et les dates rejoignent le dossier du bien." },
  { step: "4", title: "Suivez vos loyers automatiquement", text: "Les échéances se créent toutes seules ; le tableau de bord fait les comptes." },
];

const PROFILES = [
  {
    icon: Home,
    title: "Petit propriétaire",
    text: "Un ou deux biens en location : suivez loyers, documents et travaux sans tableur ni paperasse.",
  },
  {
    icon: TrendingUp,
    title: "Investisseur",
    text: "Pilotez la rentabilité réelle de chaque bien : rendement, résultat net, dépenses et travaux.",
  },
  {
    icon: Landmark,
    title: "SCI",
    text: "Centralisez les biens de la société : historique complet, documents classés et exports pour la comptabilité.",
  },
  {
    icon: HeartHandshake,
    title: "Gestion familiale",
    text: "Gérez le patrimoine familial avec un dossier clair par bien, lisible et transmissible.",
  },
];

const COMPARISON: { label: string; excel: string; immopilot: string }[] = [
  {
    label: "Suivi des loyers",
    excel: "Formules manuelles, oublis fréquents",
    immopilot: "Échéances générées automatiquement chaque mois",
  },
  {
    label: "Impayés",
    excel: "À repérer soi-même dans le tableau",
    immopilot: "Retards détectés et signalés automatiquement",
  },
  {
    label: "Documents",
    excel: "Dispersés entre disque dur et e-mails",
    immopilot: "Classés par logement dans un stockage privé",
  },
  {
    label: "Photos d'états des lieux",
    excel: "Mélangées dans la galerie du téléphone",
    immopilot: "Datées, classées, comparables avant / après",
  },
  {
    label: "Travaux et dépenses",
    excel: "Onglets qui se désynchronisent",
    immopilot: "Chantiers reliés automatiquement à la comptabilité",
  },
  {
    label: "Rentabilité",
    excel: "Calculs approximatifs, rarement à jour",
    immopilot: "Résultat net et rendement calculés en continu",
  },
  {
    label: "Accès",
    excel: "Un fichier, un seul ordinateur",
    immopilot: "Disponible partout : ordinateur, tablette, mobile",
  },
  {
    label: "Sauvegarde",
    excel: "Fichier corruptible, versions multiples",
    immopilot: "Sauvegarde automatique, données isolées par compte",
  },
];

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "Comptes sécurisés",
    text: "Connexion par e-mail avec confirmation, session protégée, routes privées inaccessibles sans authentification.",
  },
  {
    icon: ShieldCheck,
    title: "Données isolées par utilisateur",
    text: "Chaque ligne de données vous appartient explicitement : un compte ne peut jamais lire les données d'un autre.",
  },
  {
    icon: FileText,
    title: "Stockage privé des fichiers",
    text: "Documents et photos sont conservés dans un espace privé et servis par des liens signés à durée limitée.",
  },
];

/* ------------------------------------------------------------------ */
/* Données structurées (Schema.org)                                    */
/* ------------------------------------------------------------------ */

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ImmoPilot",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "fr",
      url: SITE_URL,
      description:
        "Logiciel de gestion locative pour propriétaires bailleurs : logements, locataires, loyers automatiques, documents, travaux et statistiques.",
      offers: PLANS.map((plan) => ({
        "@type": "Offer",
        name: `ImmoPilot ${plan.name}`,
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20">
        {/* Halo décoratif léger (aucune image, aucun coût réseau). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-radial-[60%_100%_at_50%_0%] from-primary/10 to-transparent"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Conçu pour les propriétaires bailleurs
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Gérez tout votre patrimoine immobilier depuis une seule plateforme.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Logements, locataires, loyers automatiques, documents, photos,
              dépenses et travaux : ImmoPilot remplace le tableur et la
              paperasse par un espace clair, à jour en permanence.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link
                href="/inscription"
                className={buttonVariants({ size: "lg", className: "w-full px-5 sm:w-auto" })}
              >
                Commencer gratuitement
              </Link>
              <a
                href="#demo"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full px-5 sm:w-auto",
                })}
              >
                Découvrir la démo
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Gratuit pour un premier logement · sans carte bancaire
            </p>
          </div>

          <Reveal className="mx-auto mt-12 max-w-4xl" delay={100}>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Barre de confiance ---------------- */}
      <section aria-label="Garanties" className="border-b border-border/60 bg-background">
        <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6">
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
      </section>

      {/* ---------------- Démonstration ---------------- */}
      <Section
        id="demo"
        eyebrow="Démonstration"
        title="Découvrez ImmoPilot en action"
        description="Des aperçus illustratifs composés avec les vrais éléments d'interface de l'application — naviguez d'un écran à l'autre."
      >
        <DemoShowcase />
      </Section>

      {/* ---------------- Fonctionnalités ---------------- */}
      <Section
        id="fonctionnalites"
        eyebrow="Fonctionnalités"
        title="Huit modules, un seul espace"
        description="Des fonctions concrètes, présentes dans l'application — pas de promesses en l'air."
        className="border-t border-border/60 bg-muted/20"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 4) * 60}>
              <div className="group h-full rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105 motion-reduce:transition-none">
                  <feature.icon className="size-4" />
                </span>
                <h3 className="mt-3 text-sm font-medium text-foreground">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {feature.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- Comment ça marche ---------------- */}
      <Section
        id="comment-ca-marche"
        eyebrow="Comment ça marche"
        title="Opérationnel en quatre étapes"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.step} delay={i * 80}>
              <div className="relative h-full rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                    {step.step}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <ArrowRight className="size-4 text-muted-foreground/50 max-lg:hidden" aria-hidden />
                  ) : null}
                </div>
                <h3 className="mt-3 text-sm font-medium text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- Pour qui ---------------- */}
      <Section
        eyebrow="Pour qui ?"
        title="Pensé pour tous les bailleurs"
        description="Du premier studio mis en location au patrimoine d'une SCI : la même rigueur, sans la complexité."
        className="border-t border-border/60 bg-muted/20"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PROFILES.map((profile, i) => (
            <Reveal key={profile.title} delay={(i % 4) * 60}>
              <div className="h-full rounded-xl border border-border bg-card p-5 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <profile.icon className="size-5" />
                </span>
                <h3 className="mt-3 text-sm font-medium text-foreground">{profile.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {profile.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- Comparaison Excel vs ImmoPilot ---------------- */}
      <Section
        eyebrow="Comparaison"
        title="La gestion locative mérite mieux qu'un tableur"
        description="Excel a rendu service. Mais quand un patrimoine grandit, chaque oubli coûte de l'argent."
      >
        <Reveal>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-4 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    &nbsp;
                  </th>
                  <th scope="col" className="p-4 text-left text-sm font-semibold text-muted-foreground">
                    Excel
                  </th>
                  <th scope="col" className="bg-primary/[0.04] p-4 text-left text-sm font-semibold text-primary">
                    ImmoPilot
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-b-0">
                    <th scope="row" className="p-4 text-left text-sm font-medium text-foreground">
                      {row.label}
                    </th>
                    <td className="p-4 text-muted-foreground">
                      <span className="flex items-start gap-2">
                        <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden />
                        {row.excel}
                      </span>
                    </td>
                    <td className="bg-primary/[0.04] p-4 text-foreground">
                      <span className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        {row.immopilot}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Section>

      {/* ---------------- Sécurité ---------------- */}
      <Section
        eyebrow="Sécurité"
        title="Vos données restent les vôtres"
        description="Pas de grandes promesses : uniquement ce que l'application fait réellement, dès aujourd'hui."
        className="border-t border-border/60 bg-muted/20"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {TRUST_POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 80}>
              <div className="h-full rounded-xl border border-border bg-card p-5">
                <point.icon className="size-5 text-primary" />
                <h3 className="mt-3 text-sm font-medium text-foreground">{point.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {point.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- Tarifs ---------------- */}
      <Section
        id="tarifs"
        eyebrow="Tarifs"
        title="Un plan pour chaque taille de patrimoine"
        description="Démarrez gratuitement avec un logement, montez en gamme quand votre patrimoine grandit."
      >
        <div className="space-y-10">
          {/* L'offre Fondateur précède TOUJOURS les abonnements.
              isStripeConfigured est lu côté serveur (jamais de clé exposée). */}
          <FounderOffer stripeEnabled={isStripeConfigured} />
          <PricingSection />
        </div>
      </Section>

      {/* ---------------- FAQ ---------------- */}
      <Section
        id="faq"
        eyebrow="FAQ"
        title="Questions fréquentes"
        description="Les réponses correspondent aux fonctions réellement disponibles dans l'application."
        className="border-t border-border/60 bg-muted/20"
      >
        <FaqSection />
      </Section>

      {/* ---------------- CTA final ---------------- */}
      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
              Reprenez le contrôle de votre patrimoine dès aujourd&apos;hui.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Créez votre compte gratuitement, ajoutez votre premier logement et
              retrouvez enfin tout au même endroit.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link
                href="/inscription"
                className={buttonVariants({ size: "lg", className: "w-full px-5 sm:w-auto" })}
              >
                Créer mon compte gratuitement
              </Link>
              <Link
                href="/connexion"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full px-5 sm:w-auto",
                })}
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
