"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNidPrice, type NidPlan } from "@/features/nireo-id/plans";
import { cn } from "@/lib/utils";

/**
 * Choix d'offre Nireo ID pour un espace.
 *
 * Aucun paiement n'est simulé : si le produit Stripe n'est pas configuré,
 * le bouton indique clairement « Bientôt disponible » et rien n'est
 * activé. L'abonnement Nireo Immo n'a aucun effet ici.
 */
export function SubscriptionPanel({
  workspaceId,
  currentPlan,
  plans,
  isOwner,
}: {
  workspaceId: string;
  currentPlan: string;
  plans: (NidPlan & { purchasable: boolean })[];
  isOwner: boolean;
}) {
  const [pending, setPending] = React.useState<string | null>(null);

  const subscribe = async (planId: string) => {
    if (pending) return;
    setPending(planId);
    try {
      const response = await fetch("/api/nireo-id/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, plan: planId }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        toast.error(data.error ?? "Le paiement n'a pas pu être lancé.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Le paiement n'a pas pu être lancé. Réessayez dans un instant.");
    } finally {
      setPending(null);
    }
  };

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {plans.map((plan) => {
        const current = plan.id === currentPlan;
        return (
          <li
            key={plan.id}
            className={cn(
              "nid-panel flex flex-col rounded-2xl p-5",
              current ? "border-primary" : ""
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-medium text-foreground">{plan.label}</h3>
              <p className="text-sm font-semibold text-foreground">{formatNidPrice(plan)}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>

            <ul className="mt-3 flex-1 space-y-1.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--nid-success)]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-4">
              {current ? (
                <p className="text-sm font-medium text-primary">Offre actuelle</p>
              ) : plan.priceCents === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Offre gratuite — appliquée automatiquement si l’abonnement s’arrête.
                </p>
              ) : !isOwner ? (
                <p className="text-sm text-muted-foreground">
                  Seul le propriétaire de l’espace peut changer d’offre.
                </p>
              ) : plan.purchasable ? (
                <Button
                  data-touch
                  onClick={() => subscribe(plan.id)}
                  disabled={pending !== null}
                >
                  {pending === plan.id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                      Redirection…
                    </>
                  ) : (
                    "Choisir cette offre"
                  )}
                </Button>
              ) : (
                <>
                  <Button data-touch disabled>
                    Bientôt disponible
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Le paiement de cette offre sera actif dès que son tarif Stripe sera renseigné.
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
