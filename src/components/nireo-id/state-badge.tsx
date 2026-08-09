import {
  FLEET_STATUS_LABELS,
  HEALTH_STATE_LABELS,
  HEALTH_STATE_TONES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_MEANINGS,
  SOURCE_TYPES,
  type FleetStatus,
  type HealthState,
  type SourceType,
} from "@/features/nireo-id/constants";
import { cn } from "@/lib/utils";

/**
 * États et provenances — jamais de score sur 100, jamais de « vérifié par
 * Nireo ». L'information n'est jamais portée par la seule couleur : le
 * libellé est toujours écrit.
 */

const TONE_CLASSES: Record<"success" | "warning" | "danger" | "info" | "neutral", string> = {
  success: "border-[color-mix(in_srgb,var(--nid-success)_35%,transparent)] text-[var(--nid-success)]",
  warning: "border-[color-mix(in_srgb,var(--nid-warning)_35%,transparent)] text-[var(--nid-warning)]",
  danger: "border-[color-mix(in_srgb,var(--nid-danger)_35%,transparent)] text-[var(--nid-danger)]",
  info: "border-[color-mix(in_srgb,var(--nid-info)_35%,transparent)] text-[var(--nid-info)]",
  neutral: "border-border text-muted-foreground",
};

export function HealthBadge({
  state,
  className,
}: {
  state: HealthState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[HEALTH_STATE_TONES[state]],
        className
      )}
    >
      {HEALTH_STATE_LABELS[state]}
    </span>
  );
}

export function FleetBadge({
  status,
  className,
}: {
  status: FleetStatus;
  className?: string;
}) {
  const tone =
    status === "declare_vole" || status === "perdu"
      ? "danger"
      : status === "en_reparation"
        ? "info"
        : "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-card px-2.5 py-0.5 text-xs",
        TONE_CLASSES[tone],
        className
      )}
    >
      {FLEET_STATUS_LABELS[status]}
    </span>
  );
}

/** Provenance d'une information (obligatoire sur chaque événement visible). */
export function SourceBadge({
  source,
  className,
}: {
  source: SourceType | string;
  className?: string;
}) {
  const key = ((SOURCE_TYPES as readonly string[]).includes(source)
    ? source
    : "declare_proprietaire") as SourceType;
  const tone = key === "atteste_reparateur" ? "success" : key === "importe" ? "info" : "neutral";
  return (
    <span
      title={SOURCE_TYPE_MEANINGS[key]}
      className={cn(
        "inline-flex items-center rounded-full border bg-card px-2 py-0.5 text-[11px]",
        TONE_CLASSES[tone],
        className
      )}
    >
      {SOURCE_TYPE_LABELS[key]}
    </span>
  );
}

/** Légende des provenances (affichée dans un rapport partagé). */
export function SourceLegend({ className }: { className?: string }) {
  return (
    <dl className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {SOURCE_TYPES.map((source) => (
        <div key={source} className="flex items-start gap-2">
          <dt className="shrink-0">
            <SourceBadge source={source} />
          </dt>
          <dd className="text-xs leading-relaxed text-muted-foreground">
            {SOURCE_TYPE_MEANINGS[source]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
