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
 * États et provenances.
 *
 * Aucune pastille colorée : un petit point d'encre suivi du libellé écrit.
 * L'information n'est jamais portée par la seule couleur — jamais de score
 * sur 100, jamais de « vérifié par Nireo ».
 */

const DOT: Record<"success" | "warning" | "danger" | "info" | "neutral", string> = {
  success: "bg-[var(--nid-success)]",
  warning: "bg-[var(--nid-warning)]",
  danger: "bg-[var(--nid-danger)]",
  info: "bg-[var(--nid-info)]",
  neutral: "bg-muted-foreground",
};

const TEXT: Record<"success" | "warning" | "danger" | "info" | "neutral", string> = {
  success: "text-[var(--nid-success)]",
  warning: "text-[var(--nid-warning)]",
  danger: "text-[var(--nid-danger)]",
  info: "text-[var(--nid-info)]",
  neutral: "text-muted-foreground",
};

function Marker({
  tone,
  children,
  title,
  className,
  small,
}: {
  tone: keyof typeof DOT;
  children: React.ReactNode;
  title?: string;
  className?: string;
  small?: boolean;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        small ? "text-[11px]" : "text-[13px]",
        TEXT[tone],
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function HealthBadge({ state, className }: { state: HealthState; className?: string }) {
  return (
    <Marker tone={HEALTH_STATE_TONES[state]} className={className}>
      {HEALTH_STATE_LABELS[state]}
    </Marker>
  );
}

export function FleetBadge({ status, className }: { status: FleetStatus; className?: string }) {
  const tone =
    status === "declare_vole" || status === "perdu"
      ? "danger"
      : status === "en_reparation"
        ? "info"
        : "neutral";
  return (
    <Marker tone={tone} className={className}>
      {FLEET_STATUS_LABELS[status]}
    </Marker>
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
    <Marker tone={tone} title={SOURCE_TYPE_MEANINGS[key]} className={className} small>
      {SOURCE_TYPE_LABELS[key]}
    </Marker>
  );
}

/** Légende des provenances (affichée dans un rapport partagé). */
export function SourceLegend({ className }: { className?: string }) {
  return (
    <dl className={cn("grid gap-2.5 sm:grid-cols-2", className)}>
      {SOURCE_TYPES.map((source) => (
        <div key={source}>
          <dt>
            <SourceBadge source={source} />
          </dt>
          <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {SOURCE_TYPE_MEANINGS[source]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
