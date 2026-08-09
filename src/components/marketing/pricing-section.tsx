"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Check, Crown, Home, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import {
  BUSINESS_CATEGORIES,
  formatLimit,
  formatPlanPrice,
  formatStorage,
  PLANS,
  type BusinessCategory,
  type Plan,
} from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";
import { PlanComparison } from "./plan-comparison";

/** Limites du plan, formulées explicitement (source : plan.limits). */
function planLimits(plan: Plan): string[] {
  const { maxProperties, maxActiveTenants, maxDocuments, maxPhotos, storageMb } = plan.limits;
  return [
    maxProperties === null ? "Logements illimités" : `${maxProperties} logement${maxProperties > 1 ? "s" : ""} max`,
    maxActiveTenants === null
      ? "Locataires actifs illimités"
      : `${maxActiveTenants} locataire${maxActiveTenants > 1 ? "s" : ""} actif${maxActiveTenants > 1 ? "s" : ""} max`,
    maxDocuments === null ? "Documents illimités" : `${formatLimit(maxDocuments)} documents max`,
    maxPhotos === null ? "Photos illimitées" : `${formatLimit(maxPhotos)} photos max`,
    `${formatStorage(storageMb)} de stockage`,
  ];
}

const CATEGORY_ICONS: Record<BusinessCategory["id"], typeof Home> = {
  gestion: Home,
  pilotage: BarChart3,
  exclusivites: Rocket,
};

/** Avantages Business+ groupés par catégorie (jamais une simple liste). */
function BusinessFeatures() {
  return (
    <div className="space-y-4">
      {BUSINESS_CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category.id];
        return (
          <div key={category.id}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground uppercase">
              <span className="flex size-5 items-center justify-center rounded-md bg-primary/10">
                <Icon className="size-3 text-primary" />
              </span>
              {category.label}
            </p>
            <ul className="mt-2 space-y-1.5 pl-0.5">
              {category.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Version COMPACTE de la grille (landing) : une carte par formule, le prix, la
 * limite de logements et les deux différences principales — la comparaison
 * détaillée reste sur /tarifs. Aucun prix ni quota n'est ressaisi : tout vient
 * de src/config/plans.ts.
 */
function CompactPricing({
  emphasis,
  paymentsEnabled,
}: {
  emphasis?: "starter" | "pro" | "founder";
  paymentsEnabled: boolean;
}) {
  const featuredId = emphasis === "starter" || emphasis === "pro" ? emphasis : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const featured = featuredId ? plan.id === featuredId : Boolean(plan.popular);
          const { maxProperties } = plan.limits;
          return (
            <Card
              key={plan.id}
              size="sm"
              className={cn("relative flex flex-col", featured && "ring-primary/40")}
            >
              {featured ? <Badge className="absolute -top-2.5 left-4">Recommandé</Badge> : null}
              <CardHeader>
                <CardTitle className="text-sm font-medium">{plan.name}</CardTitle>
                <p>
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    {formatPlanPrice(plan.monthlyPrice)} €
                  </span>
                  <span className="text-sm text-muted-foreground"> /mois</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {maxProperties === null
                    ? "Logements illimités"
                    : `Jusqu'à ${maxProperties} logement${maxProperties > 1 ? "s" : ""}`}
                  {" · "}
                  {formatStorage(plan.limits.storageMb)}
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-1.5">
                  {/* Seulement les différences principales : le détail est sur /tarifs. */}
                  {plan.highlights.slice(1, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link
                  href={plan.ctaHref}
                  data-lx={`plan-${plan.id}`}
                  data-lx-event="plan_selected"
                  onClick={() => track("cta_essai_gratuit", { source: "tarifs", plan: plan.id })}
                  className={buttonVariants({
                    variant: featured ? "default" : "outline",
                    className: "w-full",
                  })}
                >
                  {plan.cta}
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Sans engagement · annulation possible à tout moment ·{" "}
        {paymentsEnabled ? "paiement sécurisé par Stripe" : "paiement en ligne pas encore ouvert"}.
        Prix en euros TTC par mois.{" "}
        <Link
          href="/tarifs"
          className="text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
        >
          Comparer les formules en détail
        </Link>
      </p>
    </div>
  );
}

/**
 * Grille tarifaire publique — source unique : src/config/plans.ts.
 * Business+ est la carte Premium : plus grande, hiérarchie visuelle forte,
 * avantages par catégories. Tant que Stripe n'est pas activé, tous les CTA
 * mènent à l'inscription (chaque compte démarre en Gratuit). Aucun paiement simulé.
 */
export function PricingSection({
  withComparison = true,
  emphasis,
  paymentsEnabled = false,
  compact = false,
}: {
  withComparison?: boolean;
  /** Version courte pour la landing (cartes resserrées, sans comparatif). */
  compact?: boolean;
  /**
   * Plan mis en avant. Piloté par le moteur d'optimisation de la landing
   * (slot `pricing_emphasis`) ; sans valeur, on garde le plan marqué
   * « populaire » dans la configuration produit.
   */
  emphasis?: "starter" | "pro" | "founder";
  /**
   * État RÉEL du paiement en ligne (`isStripeConfigured`, lu côté serveur).
   * Tant qu'il est faux, aucune mention ne promet un paiement disponible.
   */
  paymentsEnabled?: boolean;
}) {
  // Événement interne « vue des tarifs » (aucun service tiers).
  React.useEffect(() => track("vue_tarifs"), []);

  const featuredId = emphasis === "starter" || emphasis === "pro" ? emphasis : null;

  if (compact) return <CompactPricing emphasis={emphasis} paymentsEnabled={paymentsEnabled} />;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const premium = plan.id === "business";
          const featured = featuredId ? plan.id === featuredId : Boolean(plan.popular);
          return (
          <Card
            key={plan.id}
            className={cn(
              "relative flex flex-col",
              featured && "border-primary shadow-md ring-1 ring-primary/20",
              premium &&
                // Carte Premium : légèrement plus grande, fond dégradé sobre,
                // double bordure, ombre portée moderne, survol discret.
                "border-foreground/25 bg-linear-[165deg] from-primary/[0.07] via-card to-card ring-1 ring-foreground/10 shadow-[0_16px_48px_-16px_rgb(0_0_0/0.35)] transition-[scale,box-shadow] duration-300 motion-safe:hover:shadow-[0_20px_56px_-16px_rgb(0_0_0/0.4)] xl:z-10 xl:scale-[1.04] xl:motion-safe:hover:scale-[1.05]"
            )}
          >
            {featured ? (
              <Badge className="absolute -top-2.5 left-4">Recommandé</Badge>
            ) : null}
            {premium ? (
              <Badge className="absolute -top-2.5 left-4 gap-1">
                <Crown className="size-3" />
                Le plus complet
              </Badge>
            ) : null}
            <CardHeader className={premium ? "pt-5" : undefined}>
              <CardTitle
                className={cn(
                  "text-sm font-medium",
                  premium && "flex flex-wrap items-center gap-2 text-base font-semibold"
                )}
              >
                {plan.name}
                {premium ? (
                  <Badge variant="outline" className="bg-card font-medium">
                    Recommandé pour investisseurs
                  </Badge>
                ) : null}
              </CardTitle>
              <p className="pt-1">
                <span
                  className={cn(
                    "font-semibold tracking-tight text-foreground",
                    premium ? "text-4xl" : "text-2xl"
                  )}
                >
                  {formatPlanPrice(plan.monthlyPrice)} €
                </span>
                <span className="text-sm text-muted-foreground"> /mois</span>
              </p>
              <p className="text-xs text-muted-foreground">{plan.description}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {premium ? (
                <BusinessFeatures />
              ) : (
                <ul className="space-y-2">
                  {plan.highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Limites du plan
                </p>
                <ul className="mt-1.5 space-y-1">
                  {planLimits(plan).map((limit) => (
                    <li key={limit} className="text-xs text-muted-foreground">
                      {limit}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Link
                href={plan.ctaHref}
                // Marqueurs lus par le moteur de mesure de la landing.
                data-lx={`plan-${plan.id}`}
                data-lx-event="plan_selected"
                onClick={() =>
                  track("cta_essai_gratuit", { source: "tarifs", plan: plan.id })
                }
                className={buttonVariants({
                  variant: featured || premium ? "default" : "outline",
                  className: "w-full",
                })}
              >
                {plan.cta}
              </Link>
            </CardFooter>
          </Card>
          );
        })}
      </div>

      {withComparison ? <PlanComparison /> : null}

      {/* Mention légale : elle ne peut pas annoncer un paiement disponible
          si Stripe n'est pas configuré (l'information vient du serveur), et
          les prix sont TTC — comme déclaré dans src/config/plans.ts. */}
      <p className="text-center text-xs text-muted-foreground">
        Sans engagement · annulation possible à tout moment ·{" "}
        {paymentsEnabled
          ? "paiement sécurisé par Stripe"
          : "paiement en ligne pas encore ouvert"}
        . Chaque compte démarre gratuitement. Prix en euros TTC par mois.
      </p>
    </div>
  );
}
