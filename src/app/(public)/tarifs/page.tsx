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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <JsonLd data={JSON_LD} />
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium tracking-widest text-primary uppercase">Tarifs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Un plan pour chaque taille de patrimoine
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Démarrez gratuitement, sans carte bancaire. Changez de plan quand
          votre patrimoine grandit — sans engagement.
        </p>
      </div>

      {/* Bloc marketing piloté depuis l'admin (masqué si non activé). */}
      <div className="mx-auto mt-10 max-w-3xl">
        <PromoBanner promo={marketing_promo} />
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

      <div className="mt-20">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground">
          Questions fréquentes
        </h2>
        <FaqSection items={FAQ_ITEMS} />
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
          Pour comprendre ce que fait Nireo avant de choisir un plan, lisez la
          page{" "}
          <Link
            href={PILLAR_PAGE.path}
            className="text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
          >
            logiciel de gestion locative
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
