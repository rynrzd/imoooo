"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/types";

const PLAN_OPTIONS = [
  { value: "free", label: "Gratuit" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business+" },
] as const;

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Changement de plan exceptionnel — l'action serveur choisit la voie
 * cohérente (Stripe si l'abonnement est facturé par Stripe, sinon base).
 */
export function UserPlanForm({
  currentPlan,
  action,
}: {
  currentPlan: string;
  action: (plan: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [plan, setPlan] = React.useState(currentPlan);
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (pending || plan === currentPlan) return;
    startTransition(async () => {
      const result = await action(plan);
      if (result.ok) {
        toast.success(result.message ?? "Plan mis à jour.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        className={SELECT_CLASS}
        aria-label="Nouveau plan"
      >
        {PLAN_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="sm"
        onClick={submit}
        disabled={pending || plan === currentPlan}
      >
        {pending ? "Application…" : "Changer le plan"}
      </Button>
    </div>
  );
}
