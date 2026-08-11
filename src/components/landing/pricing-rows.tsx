"use client";

import * as React from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import {
  formatPlanPrice,
  formatStorage,
  PLANS,
  propertiesLabel,
  type Plan,
} from "@/config/plans";
import { cn } from "@/lib/utils";

/**
 * Tarifs de la landing — une LIGNE par formule, pas une grille de cartes.
 *
 * Aucun prix, aucun quota, aucun libellé de bouton n'est écrit ici : tout
 * vient de src/config/plans.ts (source de vérité unique, également appliquée
 * par les triggers en base). Ajouter ou modifier un plan là-bas met cette
 * section à jour sans y toucher.
 *
 * `emphasis` vient du moteur de personnalisation ; sans valeur, c'est le plan
 * marqué « populaire » dans la configuration produit qui ressort.
 */

/** Deux différences marquantes par formule — jamais la liste complète. */
function keyPoints(plan: Plan): string[] {
  return plan.highlights.slice(1, 3);
}

export function PricingRows({
  emphasis,
  paymentsEnabled,
}: {
  emphasis?: "starter" | "pro" | "founder";
  paymentsEnabled: boolean;
}) {
  // Événement interne « vue des tarifs » (aucun service tiers).
  React.useEffect(() => track("vue_tarifs"), []);

  const featuredId = emphasis === "starter" || emphasis === "pro" ? emphasis : null;

  return (
    <div>
      <ul className="border-t border-border">
        {PLANS.map((plan) => {
          const featured = featuredId ? plan.id === featuredId : Boolean(plan.popular);
          return (
            <li
              key={plan.id}
              className={cn(
                "border-b border-border transition-colors",
                featured
                  ? "border-l-2 border-l-primary bg-[color-mix(in_srgb,var(--land-blue-pale)_55%,var(--land-paper))] pl-4 sm:pl-6"
                  : "border-l-2 border-l-transparent pl-4 hover:bg-[color-mix(in_srgb,var(--land-paper)_70%,transparent)] sm:pl-6"
              )}
            >
              <div className="flex flex-col gap-4 py-5 pr-4 sm:py-6 sm:pr-6 lg:flex-row lg:items-center lg:gap-8">
                {/* Nom + quotas */}
                <div className="lg:w-[15rem] lg:shrink-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[1.05rem] font-semibold text-foreground">{plan.name}</span>
                    {featured ? (
                      <span className="rounded-[3px] bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-[var(--land-paper)] uppercase">
                        Recommandé
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[0.82rem] text-muted-foreground">
                    {/* Seule la PREMIÈRE lettre passe en capitale (`capitalize`
                        capitaliserait chaque mot : « 5 Logements »), et la
                        donnée elle-même n'est pas réécrite. */}
                    <span className="inline-block first-letter:uppercase">
                      {propertiesLabel(plan)}
                    </span>
                    {" · "}
                    {formatStorage(plan.limits.storageMb)}
                  </p>
                </div>

                {/* Prix */}
                <p className="lg:w-[8.5rem] lg:shrink-0">
                  <span className="text-[1.6rem] font-semibold tracking-tight tabular-nums text-foreground">
                    {formatPlanPrice(plan.monthlyPrice)} €
                  </span>
                  <span className="text-[0.85rem] text-muted-foreground"> /mois</span>
                </p>

                {/* Différences principales */}
                <ul className="min-w-0 flex-1 space-y-1">
                  {keyPoints(plan).map((point) => (
                    <li key={point} className="flex gap-2.5 text-[0.85rem] text-muted-foreground">
                      <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-[var(--land-stone)]" />
                      {point}
                    </li>
                  ))}
                </ul>

                {/* Action */}
                <Link
                  href={plan.ctaHref}
                  data-lx={`plan-${plan.id}`}
                  data-lx-event="plan_selected"
                  onClick={() => track("cta_essai_gratuit", { source: "tarifs", plan: plan.id })}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center justify-center rounded-[5px] px-5 text-[0.9rem] font-medium transition-colors",
                    featured
                      ? "bg-primary text-[var(--land-paper)] hover:bg-[color-mix(in_srgb,var(--land-blue)_88%,var(--land-ink))]"
                      : "border border-border bg-[var(--land-paper)] text-foreground hover:border-[var(--land-stone)]"
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-[0.82rem] text-muted-foreground">
        Sans engagement · annulation possible à tout moment ·{" "}
        {paymentsEnabled ? "paiement sécurisé par Stripe" : "paiement en ligne pas encore ouvert"}.
        Prix en euros TTC par mois.{" "}
        <Link
          href="/tarifs"
          className="font-medium text-foreground underline decoration-[var(--land-stone)] underline-offset-4 transition-colors hover:decoration-primary"
        >
          Comparer les formules en détail
        </Link>
      </p>
    </div>
  );
}
