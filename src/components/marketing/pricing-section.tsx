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
  PLANS,
  type BusinessCategory,
  type Plan,
} from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";
import { PlanComparison } from "./plan-comparison";

/** Limites du plan, formulées explicitement (source : plan.limits). */
function planLimits(plan: Plan): string[] {
  const { maxProperties, maxActiveTenants, maxDocuments, maxPhotos, storageMb } = plan.limits;
  const storage = storageMb >= 1024 ? `${storageMb / 1024} Go` : `${storageMb} Mo`;
  return [
    maxProperties === null ? "Logements illimités" : `${maxProperties} logement${maxProperties > 1 ? "s" : ""} max`,
    maxActiveTenants === null
      ? "Locataires actifs illimités"
      : `${maxActiveTenants} locataire${maxActiveTenants > 1 ? "s" : ""} actif${maxActiveTenants > 1 ? "s" : ""} max`,
    maxDocuments === null ? "Documents illimités" : `${maxDocuments} documents max`,
    maxPhotos === null ? "Photos illimitées" : `${maxPhotos} photos max`,
    `${storage} de stockage`,
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
 * Grille tarifaire publique — source unique : src/config/plans.ts.
 * Business+ est la carte Premium : plus grande, hiérarchie visuelle forte,
 * avantages par catégories. Tant que Stripe n'est pas activé, tous les CTA
 * mènent à l'inscription (chaque compte démarre en Gratuit). Aucun paiement simulé.
 */
export function PricingSection({ withComparison = true }: { withComparison?: boolean }) {
  // Événement interne « vue des tarifs » (aucun service tiers).
  React.useEffect(() => track("vue_tarifs"), []);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const premium = plan.id === "business";
          return (
          <Card
            key={plan.id}
            className={cn(
              "relative flex flex-col",
              plan.popular && "border-primary shadow-md ring-1 ring-primary/20",
              premium &&
                // Carte Premium : légèrement plus grande, fond dégradé sobre,
                // double bordure, ombre portée moderne, survol discret.
                "border-foreground/25 bg-linear-[165deg] from-primary/[0.07] via-card to-card ring-1 ring-foreground/10 shadow-[0_16px_48px_-16px_rgb(0_0_0/0.35)] transition-[scale,box-shadow] duration-300 motion-safe:hover:shadow-[0_20px_56px_-16px_rgb(0_0_0/0.4)] xl:z-10 xl:scale-[1.04] xl:motion-safe:hover:scale-[1.05]"
            )}
          >
            {plan.popular ? (
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
                  {plan.monthlyPrice.toLocaleString("fr-FR", {
                    minimumFractionDigits: plan.monthlyPrice % 1 === 0 ? 0 : 2,
                  })}{" "}
                  €
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
                onClick={() =>
                  track("cta_essai_gratuit", { source: "tarifs", plan: plan.id })
                }
                className={buttonVariants({
                  variant: plan.popular || premium ? "default" : "outline",
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

      <p className="text-center text-xs text-muted-foreground">
        Sans engagement · annulation possible à tout moment · paiement sécurisé
        par Stripe. Chaque compte démarre gratuitement. Prix indiqués hors taxes.
      </p>
    </div>
  );
}
