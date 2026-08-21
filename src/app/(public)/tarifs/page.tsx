import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FaqSection, getFaqItems } from "@/components/marketing/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { PILLAR_PAGE } from "@/config/seo-pages";
import { isUserAdmin } from "@/lib/admin/auth";
import { getPublicSiteSettings } from "@/lib/admin/settings";
import { withVerifiedPromoCode } from "@/lib/promo/banner";
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
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const TITLE = "Tarifs";
const DESCRIPTION =
  "Les plans Nireo : Gratuit, Starter, Pro et Business+. Démarrez gratuitement avec un logement, montez en gamme quand votre patrimoine grandit.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tarifs" },
  // Sans ceci, partager cette page affiche le titre générique du layout racine
  // (« Nireo — Gérez tout votre patrimoine… ») au lieu de « Tarifs ».
  openGraph: { type: "website", url: "/tarifs", title: TITLE, description: DESCRIPTION },
};

/** Même liste pour l'accordéon visible et le balisage FAQPage. */
const FAQ_ITEMS = getFaqItems({ paymentsEnabled: isStripeConfigured });

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: "Tarifs", path: "/tarifs" },
];

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd({ name: `${TITLE} — Nireo`, description: DESCRIPTION, path: "/tarifs" }),
  breadcrumbJsonLd(CRUMBS),
  faqPageJsonLd(FAQ_ITEMS, `${SITE_URL}/tarifs`),
]);

export default async function PricingPage() {
  // Un administrateur connecté n'a pas accès à la page Tarifs : il n'est
  // pas un client Nireo (contrôle serveur, table admin_users).
  if (isSupabaseConfigured && isAdminConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && (await isUserAdmin(user.id))) redirect("/admin");
  }

  const { marketing_promo } = await getPublicSiteSettings();
  // Un code annoncé mais inutilisable au paiement ne doit jamais être affiché.
  const promo = await withVerifiedPromoCode(marketing_promo);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <JsonLd data={JSON_LD} />
      <div data-reveal className="nl-seq mx-auto max-w-2xl text-center">
        {/* Surtitre à filet : l'idiome de la landing, pas une pastille. */}
        <p
          data-seq
          className="flex items-center justify-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-gray)] uppercase"
        >
          <span
            aria-hidden
            data-seq-rule
            style={{ ["--nl-delay" as string]: "120ms", ["--nl-dur" as string]: "0.5s" }}
            className="h-px w-8 bg-[var(--nl-cobalt)]"
          />
          Tarifs
        </p>
        <h1 className="mt-6 text-[clamp(2rem,5.5vw,3rem)] font-semibold text-balance text-foreground">
          <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
            <span>Un plan pour chaque taille de patrimoine</span>
          </span>
        </h1>
        <p
          data-seq
          style={{ ["--nl-delay" as string]: "260ms" }}
          className="mt-5 text-[0.98rem] leading-relaxed text-muted-foreground sm:text-base"
        >
          Démarrez gratuitement, sans carte bancaire. Changez de plan quand
          votre patrimoine grandit — sans engagement.
        </p>
      </div>

      {/* Bloc marketing piloté depuis l'admin (masqué si non activé). */}
      <div className="mx-auto mt-10 max-w-3xl">
        <PromoBanner promo={promo} />
      </div>

      <div className="mt-12">
        {/* L'offre Fondateur vit AU-DESSUS des abonnements (disparaît seule
            une fois les 100 places vendues). isStripeConfigured est lu côté
            serveur — jamais de clé exposée. */}
        <FounderOffer stripeEnabled={isStripeConfigured} />
      </div>

      <div className="mt-14">
        <PricingSection paymentsEnabled={isStripeConfigured} />
      </div>

      {/* Ancre `#faq` : la FAQ n'est plus sur l'accueil, les liens du footer
          et des pages de contenu atterrissent donc ici. */}
      <div id="faq" className="mt-20 scroll-mt-24">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground">
          Questions fréquentes
        </h2>
        <FaqSection items={FAQ_ITEMS} />
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
          Pour comprendre ce que fait Nireo avant de choisir un plan, lisez la
          page{" "}
          <Link
            href={PILLAR_PAGE.path}
            className="nl-focus font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
          >
            logiciel de gestion locative
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
