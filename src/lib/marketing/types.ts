/**
 * Types et libellés du module « Marketing & Partenaires ».
 * Fichier SANS code serveur : importable par les composants client.
 *
 * Argent : tous les montants sont en CENTIMES (integer), sauf
 * commission_value / commission_rate : % si type « percent »,
 * euros si type « fixed ».
 */

export type PartnerType =
  | "assurance"
  | "agence_immobiliere"
  | "courtier"
  | "comptable"
  | "notaire"
  | "artisan"
  | "influenceur"
  | "autre";

export type CommissionType = "percent" | "fixed";
export type CommissionDurationType = "first_payment" | "months" | "lifetime";

export type CommissionStatus =
  | "pending"
  | "approved"
  | "payable"
  | "paid"
  | "cancelled"
  | "reversed";

export type PayoutStatus = "draft" | "approved" | "paid" | "cancelled";

export interface MarketingPartnerRow {
  id: string;
  name: string;
  company_name: string;
  partner_type: PartnerType;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  referral_code: string;
  referral_slug: string;
  commission_type: CommissionType;
  commission_value: number;
  commission_duration_type: CommissionDurationType;
  commission_duration_months: number | null;
  applicable_plans: string[];
  attribution_window_days: number;
  attribution_model: "first_click";
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerClickRow {
  id: string;
  partner_id: string;
  referral_code: string;
  landing_page: string;
  source: string;
  campaign: string;
  ip_hash: string;
  user_agent: string;
  clicked_at: string;
}

export interface PartnerAttributionRow {
  id: string;
  partner_id: string;
  user_id: string;
  referral_code: string;
  first_click_at: string | null;
  signup_at: string;
  converted_at: string | null;
  status: "signed_up" | "converted";
  created_at: string;
  updated_at: string;
}

export interface PartnerCommissionRow {
  id: string;
  partner_id: string;
  user_id: string | null;
  subscription_id: string;
  stripe_invoice_id: string;
  stripe_payment_intent_id: string;
  plan: string;
  gross_amount: number;
  eligible_amount: number;
  commission_type: CommissionType;
  commission_rate: number;
  commission_amount: number;
  currency: string;
  status: CommissionStatus;
  earned_at: string;
  approved_at: string | null;
  payable_at: string | null;
  paid_at: string | null;
  payout_id: string | null;
  reversal_reason: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerPayoutRow {
  id: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  currency: string;
  status: PayoutStatus;
  payment_method: string;
  payment_reference: string;
  paid_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** Cagnotte d'un partenaire — TOUJOURS calculée depuis les commissions. */
export interface PartnerBalance {
  pendingCents: number;
  approvedCents: number;
  payableCents: number;
  paidCents: number;
  cancelledCents: number;
  reversedCents: number;
  /** Total généré depuis le début (hors annulées/reversées). */
  totalEarnedCents: number;
  /** CA TTC encaissé attribué (somme des gross non annulés/reversés). */
  grossRevenueCents: number;
}

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  assurance: "Assurance",
  agence_immobiliere: "Agence immobilière",
  courtier: "Courtier",
  comptable: "Comptable",
  notaire: "Notaire",
  artisan: "Artisan",
  influenceur: "Influenceur",
  autre: "Autre",
};

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  percent: "Pourcentage",
  fixed: "Montant fixe / client payant",
};

export const COMMISSION_DURATION_LABELS: Record<CommissionDurationType, string> = {
  first_payment: "Premier paiement uniquement",
  months: "Pendant N mois",
  lifetime: "Tant que l’abonnement est actif",
};

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "En attente",
  approved: "Validée",
  payable: "Disponible",
  paid: "Payée",
  cancelled: "Annulée",
  reversed: "Remboursée",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  draft: "Brouillon",
  approved: "Approuvé",
  paid: "Payé",
  cancelled: "Annulé",
};

/** true si la date d'expiration est passée (helper hors composant). */
export function isPartnerExpired(expiresAt: string | null): boolean {
  return expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
}

/** Formats d'euros depuis des centimes — « 1 234,56 € ». */
export function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Résumé lisible de la règle de commission d'un partenaire. */
export function commissionRuleLabel(p: {
  commission_type: CommissionType;
  commission_value: number;
  commission_duration_type: CommissionDurationType;
  commission_duration_months: number | null;
}): string {
  if (p.commission_value <= 0) return "Aucune commission configurée";
  if (p.commission_type === "fixed") {
    return `${p.commission_value.toFixed(2).replace(".", ",")} € par client payant (une fois)`;
  }
  const pct = `${String(p.commission_value).replace(".", ",")} %`;
  switch (p.commission_duration_type) {
    case "first_payment":
      return `${pct} sur le premier paiement`;
    case "months":
      return `${pct} pendant ${p.commission_duration_months ?? 0} mois`;
    case "lifetime":
      return `${pct} tant que l’abonnement est actif`;
  }
}
