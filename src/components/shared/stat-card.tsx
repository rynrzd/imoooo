import Link from "next/link";
import {
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface StatTrend {
  direction: "up" | "down" | "flat";
  label: string;
  tone: "positive" | "negative" | "neutral";
}

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Précision affichée sous la valeur (ex. "sur 3 180 € attendus"). */
  hint?: string;
  /** Teinte du pictogramme. */
  tone?: "default" | "positive" | "negative" | "warning";
  /** Progression 0-100 affichée sous la valeur (ex. loyers encaissés). */
  progress?: number;
  /** Évolution courte (ex. "+12 % vs juin"). */
  trend?: StatTrend;
  /** Rend la carte cliquable vers la page concernée. */
  href?: string;
}

/* Jetons sémantiques : une couleur = un sens, en clair comme en sombre. */

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-muted text-foreground/70",
  positive: "bg-success-soft text-success",
  negative: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

const PROGRESS_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary",
  positive: "bg-success",
  negative: "bg-danger",
  warning: "bg-warning",
};

const TREND_CLASSES: Record<StatTrend["tone"], string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-muted-foreground",
};

const TREND_ICONS: Record<StatTrend["direction"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

/** Tuile de statistique : libellé, valeur, tendance, indication optionnelle. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  progress,
  trend,
  href,
}: StatCardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;

  const card = (
    <Card className={cn("py-4", href && "card-lift h-full")}>
      <CardContent className="space-y-2.5 px-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[13px] text-muted-foreground">{label}</p>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              TONE_CLASSES[tone]
            )}
          >
            <Icon className="size-3.5" />
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
          {typeof progress === "number" ? (
            <Progress
              value={progress}
              indicatorClassName={PROGRESS_CLASSES[tone]}
              aria-label={label}
            />
          ) : null}
          {trend && TrendIcon ? (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                TREND_CLASSES[trend.tone]
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden />
              {trend.label}
            </p>
          ) : null}
          {hint ? (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${label} — voir le détail`} className="block h-full">
        {card}
      </Link>
    );
  }
  return card;
}
