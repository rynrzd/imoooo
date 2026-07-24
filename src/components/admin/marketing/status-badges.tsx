import {
  COMMISSION_STATUS_LABELS,
  isPartnerExpired,
  PAYOUT_STATUS_LABELS,
  type CommissionStatus,
  type PayoutStatus,
} from "@/lib/marketing/types";

/** Palette sobre partagée pour les badges de statut du module Marketing. */
const BASE = "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium";

const TONE = {
  neutral: "border-border bg-muted text-muted-foreground",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
} as const;

const COMMISSION_TONE: Record<CommissionStatus, keyof typeof TONE> = {
  pending: "amber",
  approved: "blue",
  payable: "violet",
  paid: "emerald",
  cancelled: "neutral",
  reversed: "red",
};

const PAYOUT_TONE: Record<PayoutStatus, keyof typeof TONE> = {
  draft: "neutral",
  approved: "blue",
  paid: "emerald",
  cancelled: "red",
};

export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  return <span className={`${BASE} ${TONE[COMMISSION_TONE[status]]}`}>{COMMISSION_STATUS_LABELS[status]}</span>;
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <span className={`${BASE} ${TONE[PAYOUT_TONE[status]]}`}>{PAYOUT_STATUS_LABELS[status]}</span>;
}

export function PartnerStatusBadge({
  isActive,
  expiresAt,
}: {
  isActive: boolean;
  expiresAt: string | null;
}) {
  // `expired` est passé pré-calculé (pas de Date.now() pendant le rendu).
  if (!isActive) return <span className={`${BASE} ${TONE.neutral}`}>Inactif</span>;
  if (isPartnerExpired(expiresAt)) return <span className={`${BASE} ${TONE.red}`}>Expiré</span>;
  return <span className={`${BASE} ${TONE.emerald}`}>Actif</span>;
}
