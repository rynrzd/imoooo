import { Badge } from "@/components/ui/badge";
import { getPlan } from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";

/** Badge du plan de l'utilisateur (Gratuit, Essentiel, Pro, Business). */
export function PlanBadge({
  planId,
  className,
}: {
  planId: string | null | undefined;
  className?: string;
}) {
  const plan = getPlan(planId);
  return (
    <Badge
      variant={plan.id === "free" ? "secondary" : "default"}
      className={cn("uppercase tracking-wide", className)}
    >
      Plan {plan.name}
    </Badge>
  );
}
