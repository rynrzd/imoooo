import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  FileText,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { trustLevelInfo } from "@/features/nireo-id/constants";
import { cn } from "@/lib/utils";

/**
 * Niveau de confiance d'une information.
 *
 * La couleur ne porte JAMAIS l'information seule : chaque badge combine
 * une icône, un libellé et une couleur. Le libellé dit exactement ce que
 * Nireo garantit — jamais « vérifié par Nireo ».
 */

const ICONS: Record<number, LucideIcon> = {
  0: PenLine,
  1: FileText,
  2: BadgeCheck,
  3: AlertTriangle,
  4: Ban,
};

const TONES: Record<string, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-[color-mix(in_srgb,var(--nid-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-info)_12%,transparent)] text-[var(--nid-info)]",
  success:
    "border-[color-mix(in_srgb,var(--nid-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-success)_12%,transparent)] text-[var(--nid-success)]",
  warning:
    "border-[color-mix(in_srgb,var(--nid-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-warning)_12%,transparent)] text-[var(--nid-warning)]",
  danger:
    "border-[color-mix(in_srgb,var(--nid-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-danger)_12%,transparent)] text-[var(--nid-danger)]",
};

interface TrustBadgeProps {
  level: number;
  /** `full` affiche le libellé complet, `short` la version compacte. */
  variant?: "full" | "short";
  className?: string;
}

export function TrustBadge({ level, variant = "short", className }: TrustBadgeProps) {
  const info = trustLevelInfo(level);
  const Icon = ICONS[info.value] ?? PenLine;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[info.tone] ?? TONES.neutral,
        className
      )}
      title={info.meaning}
    >
      <Icon className="size-3" aria-hidden />
      {variant === "full" ? info.label : info.short}
    </span>
  );
}

/** Légende complète des niveaux — utilisée sur la vitrine et l'aide. */
export function TrustLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {[0, 1, 2, 3].map((level) => {
        const info = trustLevelInfo(level);
        return (
          <li key={level} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
            <TrustBadge level={level} variant="full" className="shrink-0" />
            <p className="text-sm text-muted-foreground">{info.meaning}</p>
          </li>
        );
      })}
    </ul>
  );
}
