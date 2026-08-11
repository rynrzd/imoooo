"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PLAN_ID,
  formatPlanPrice,
  getPlan,
  propertiesLabel,
  propertyRangeChoices,
  recommendPlanForProperties,
  type PaidPlanId,
  type PropertyRangeChoice,
} from "@/config/plans";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

/**
 * Étape de bienvenue — « Combien de logements gérez-vous ? »
 *
 * Ce que fait cette étape, et RIEN d'autre :
 * - elle demande la taille du patrimoine ;
 * - elle en déduit le plus petit plan compatible, uniquement à partir de
 *   `src/config/plans.ts` (aucun prix, aucun quota, aucun palier ressaisi ici) ;
 * - elle propose ce plan, sans jamais déclencher de paiement toute seule : le
 *   plan Gratuit reste toujours accessible en un clic, et un plan payant passe
 *   par le Checkout Stripe EXISTANT (`POST /api/stripe/checkout`).
 *
 * Ce qu'elle ne fait pas : aucun faux essai gratuit, aucune promesse hors
 * grille tarifaire, aucune nouvelle colonne en base. La réponse n'est pas
 * mémorisée — seul le fait que l'étape a été franchie l'est, via la route
 * d'onboarding déjà en place (`POST /api/onboarding`, `onboarding_started_at`).
 */

/** Le plan de repli, toujours proposé : personne n'est jamais bloqué. */
const FREE_PLAN = getPlan(DEFAULT_PLAN_ID);

/** Marque l'étape comme franchie. Best-effort : ne bloque jamais le parcours. */
async function markStepDone(): Promise<void> {
  try {
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "step", step: 1 }),
      keepalive: true,
    });
  } catch (e) {
    logger.error("bienvenue/step", e);
  }
}

export function PlanRecommendation({
  firstName,
  stripeEnabled,
}: {
  firstName: string;
  /** Sans clés Stripe, aucun bouton de paiement n'est affiché. */
  stripeEnabled: boolean;
}) {
  const router = useRouter();
  const choices = React.useMemo(() => propertyRangeChoices(), []);
  const [choice, setChoice] = React.useState<PropertyRangeChoice | null>(null);
  const [pending, setPending] = React.useState<"free" | "paid" | null>(null);

  const plan = choice ? recommendPlanForProperties(choice.value) : null;

  /** Continuer avec le plan Gratuit : jamais de paiement, jamais de blocage. */
  const continueFree = async () => {
    if (pending) return;
    setPending("free");
    await markStepDone();
    router.replace("/logements");
  };

  /** Plan payant : uniquement sur action explicite, via le Checkout existant. */
  const startCheckout = async (planId: PaidPlanId) => {
    if (pending) return;
    setPending("paid");
    await markStepDone();
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Paiement indisponible pour le moment.");
      }
      window.location.assign(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement indisponible.");
      setPending(null);
    }
  };

  /* ---------------- Étape 1 : la question ---------------- */

  if (!choice || !plan) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Combien de logements gérez-vous&nbsp;?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {firstName ? `Bienvenue ${firstName}. ` : "Bienvenue. "}
          Une seule question, pour vous proposer le plan adapté. Vous pourrez en
          changer à tout moment.
        </p>

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          {choices.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChoice(item)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left",
                "text-sm font-medium text-foreground transition-colors",
                "hover:border-primary/50 hover:bg-primary/5",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              )}
            >
              <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Aucun paiement n&apos;est déclenché à cette étape.
        </p>
      </div>
    );
  }

  /* ---------------- Étape 2 : le plan recommandé ---------------- */

  const isFree = plan.id === "free";
  const price = formatPlanPrice(plan.monthlyPrice);

  return (
    <div>
      <button
        type="button"
        onClick={() => setChoice(null)}
        disabled={pending !== null}
        className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Modifier ma réponse
      </button>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {isFree ? "Le plan Gratuit vous suffit." : `Le plan ${plan.name} est fait pour vous.`}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Vous avez indiqué&nbsp;: <span className="text-foreground">{choice.label}</span>.{" "}
        {choice.beyond ? (
          <>
            C&apos;est le plan le plus large proposé aujourd&apos;hui. Au-delà de{" "}
            {plan.limits.maxProperties} logements,{" "}
            <Link href="/contact" className="text-foreground underline underline-offset-4">
              écrivez-nous
            </Link>
            .
          </>
        ) : (
          "C'est le plus petit plan qui couvre ce patrimoine."
        )}
      </p>

      {/* Le plan recommandé — un seul, jamais la grille complète. */}
      <div className="mt-6 rounded-2xl border border-primary/30 bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-base font-semibold text-foreground">Nireo {plan.name}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {price}&nbsp;€
            </span>
            <span className="text-sm text-muted-foreground">/mois</span>
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan.description} — {propertiesLabel(plan)}.
        </p>

        <ul className="mt-4 space-y-2">
          {plan.highlights.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-3">
        {isFree ? (
          <Button className="w-full" disabled={pending !== null} onClick={() => void continueFree()}>
            {pending === "free" ? "Ouverture…" : "Ajouter mon premier logement"}
          </Button>
        ) : stripeEnabled ? (
          <Button
            className="w-full"
            disabled={pending !== null}
            onClick={() => void startCheckout(plan.id as PaidPlanId)}
          >
            {pending === "paid"
              ? "Redirection vers le paiement…"
              : `Choisir ${plan.name} — ${price} €/mois`}
          </Button>
        ) : (
          // Sans Stripe configuré : jamais de faux bouton de paiement.
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Le paiement en ligne n&apos;est pas encore disponible. Commencez avec
            le plan Gratuit&nbsp;: vous pourrez changer de plan depuis votre
            espace dès son ouverture.
          </p>
        )}

        {!isFree ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={pending !== null}
            onClick={() => void continueFree()}
          >
            {pending === "free"
              ? "Ouverture…"
              : `Continuer avec le plan ${FREE_PLAN.name} — ${propertiesLabel(FREE_PLAN)}`}
          </Button>
        ) : null}

        <p className="text-center text-sm">
          <Link
            href="/tarifs"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Voir les autres plans
          </Link>
        </p>
      </div>

      {!isFree ? (
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Paiement sécurisé par Stripe, sans engagement, résiliable à tout moment.
          Aucun montant n&apos;est débité tant que vous n&apos;avez pas validé le
          paiement.
        </p>
      ) : null}
    </div>
  );
}
