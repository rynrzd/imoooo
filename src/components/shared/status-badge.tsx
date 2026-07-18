import { Badge } from "@/components/ui/badge";
import {
  PROPERTY_STATUS_LABELS,
  RENT_STATUS_LABELS,
  WORK_STATUS_LABELS,
} from "@/lib/labels";
import type { PropertyStatus, RentStatus, WorkStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Badges de statut du domaine.
 * Le statut est toujours porté par une pastille + un libellé,
 * jamais par la couleur seule (accessibilité).
 */

type Tone = "positive" | "neutral" | "warning" | "negative" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800 [&_.dot]:bg-emerald-500",
  neutral: "border-border bg-muted text-muted-foreground [&_.dot]:bg-muted-foreground/60",
  warning: "border-amber-200 bg-amber-50 text-amber-800 [&_.dot]:bg-amber-500",
  negative: "border-red-200 bg-red-50 text-red-800 [&_.dot]:bg-red-500",
  info: "border-blue-200 bg-blue-50 text-blue-800 [&_.dot]:bg-blue-500",
};

function DotBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", TONE_CLASSES[tone])}>
      <span className="dot size-1.5 rounded-full" aria-hidden />
      {label}
    </Badge>
  );
}

const PROPERTY_TONES: Record<PropertyStatus, Tone> = {
  loue: "positive",
  vacant: "warning",
  travaux: "info",
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return <DotBadge tone={PROPERTY_TONES[status]} label={PROPERTY_STATUS_LABELS[status]} />;
}

const RENT_TONES: Record<RentStatus, Tone> = {
  paye: "positive",
  attente: "neutral",
  retard: "negative",
  partiel: "warning",
};

export function RentStatusBadge({ status }: { status: RentStatus }) {
  return <DotBadge tone={RENT_TONES[status]} label={RENT_STATUS_LABELS[status]} />;
}

const WORK_TONES: Record<WorkStatus, Tone> = {
  planifie: "neutral",
  en_cours: "info",
  termine: "positive",
};

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return <DotBadge tone={WORK_TONES[status]} label={WORK_STATUS_LABELS[status]} />;
}
