import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { HealthReport } from "@/lib/insights";
import { cn } from "@/lib/utils";

interface HealthScoreProps {
  report: HealthReport;
}

const SCORE_TONE: Record<HealthReport["label"], string> = {
  Excellent: "text-emerald-700 dark:text-emerald-400",
  Bon: "text-emerald-700 dark:text-emerald-400",
  "À surveiller": "text-amber-700 dark:text-amber-400",
  Fragile: "text-red-700 dark:text-red-400",
};

/** Bloc « Santé du patrimoine » : score global et facteurs explicites. */
export function HealthScore({ report }: HealthScoreProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-4 lg:w-56 lg:flex-col lg:items-start lg:gap-1.5">
          <p className="text-[13px] text-muted-foreground">Santé du patrimoine</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {report.score}
            <span className="text-base font-normal text-muted-foreground">/100</span>
          </p>
          <p className={cn("text-sm font-medium", SCORE_TONE[report.label])}>
            {report.label}
          </p>
        </div>

        <div className="hidden h-16 w-px shrink-0 bg-border lg:block" aria-hidden />

        <ul className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {report.factors.map((factor) => (
            <li key={factor.id} className="flex items-center gap-2 text-sm">
              {factor.ok ? (
                <CheckCircle2
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              ) : (
                <CircleAlert
                  className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
              )}
              <span className={factor.ok ? "text-muted-foreground" : "text-foreground"}>
                {factor.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
