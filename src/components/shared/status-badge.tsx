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

/**
 * Les cinq tons viennent des JETONS sémantiques (globals.css), plus d'une
 * palette Tailwind brute : le thème sombre reprend donc exactement la même
 * identité, sans qu'aucune variante `dark:` soit écrite ici.
 */
const TONE_CLASSES: Record<Tone, string> = {
  positive: "border-transparent bg-success-soft text-success [&_.dot]:bg-success",
  neutral: "border-border bg-muted text-muted-foreground [&_.dot]:bg-muted-foreground/60",
  warning: "border-transparent bg-warning-soft text-warning [&_.dot]:bg-warning",
  negative: "border-transparent bg-danger-soft text-danger [&_.dot]:bg-danger",
  info: "border-transparent bg-primary-soft text-primary [&_.dot]:bg-primary",
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
