import type { Metadata } from "next";
import { FaqSection } from "@/components/marketing/faq-section";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { isStripeConfigured } from "@/lib/stripe/config";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Les plans Noviqo : Gratuit, Starter, Pro et Business+. Démarrez gratuitement avec un logement, montez en gamme quand votre patrimoine grandit.",
  alternates: { canonical: "/tarifs" },
};

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
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

      <div className="mt-12">
        {/* L'offre Fondateur vit AU-DESSUS des abonnements (disparaît seule
            une fois les 100 places vendues). isStripeConfigured est lu côté
            serveur — jamais de clé exposée. */}
        <FounderOffer stripeEnabled={isStripeConfigured} />
      </div>

      <div className="mt-14">
        <PricingSection />
      </div>

      <div className="mt-20">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground">
          Questions fréquentes
        </h2>
        <FaqSection />
      </div>
    </div>
  );
}
