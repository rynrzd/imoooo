import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MarketingPartnerRow,
  PartnerBalance,
  CommissionType,
  CommissionDurationType,
  PartnerType,
} from "./types";

/**
 * Gestion des partenaires — SERVEUR uniquement (clé secrète).
 * Toute écriture passe par les routes API admin (rôle vérifié en base)
 * qui journalisent dans admin_audit_logs.
 */

const PARTNER_TYPES: PartnerType[] = [
  "assurance",
  "agence_immobiliere",
  "courtier",
  "comptable",
  "notaire",
  "artisan",
  "influenceur",
  "autre",
];

/** Alphabet sans ambiguïté (pas de 0/O, 1/l/I) — code non devinable. */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

/** Slug lisible depuis un nom : « Assurance Dupont » → « assurance-dupont ». */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    // La découpe à 50 caractères ne doit pas laisser de tiret final
    // (violerait la contrainte SQL du slug).
    .replace(/-+$/g, "");
}

/** Code partenaire unique (10 caractères aléatoires, vérifié en base). */
export async function generateUniqueCode(): Promise<string> {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(10);
    const { data, error } = await admin
      .from("marketing_partners")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (error) throw new Error(`Vérification du code impossible : ${error.message}`);
    if (!data) return code;
  }
  throw new Error("Génération d'un code partenaire unique impossible. Réessayez.");
}

/** Slug unique : base lisible + suffixe numérique si déjà pris. */
export async function generateUniqueSlug(base: string): Promise<string> {
  const admin = createAdminClient();
  const clean = slugify(base) || `partenaire-${randomCode(4)}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? clean : `${clean.slice(0, 46)}-${attempt + 1}`;
    const { data, error } = await admin
      .from("marketing_partners")
      .select("id")
      .eq("referral_slug", candidate)
      .maybeSingle();
    if (error) throw new Error(`Vérification du slug impossible : ${error.message}`);
    if (!data) return candidate;
  }
  return `${clean.slice(0, 40)}-${randomCode(4)}`;
}

export interface PartnerInput {
  name: string;
  companyName: string;
  partnerType: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  commissionType: string;
  commissionValue: number;
  commissionDurationType: string;
  commissionDurationMonths: number | null;
  applicablePlans: string[];
  attributionWindowDays: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
}

/** Validation serveur stricte — jamais confiance au navigateur. */
export function validatePartnerInput(raw: Record<string, unknown>): PartnerInput {
  const str = (key: string, max: number, required = false): string => {
    const value = typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
    if (required && !value) throw new Error(`Champ requis manquant : ${key}.`);
    return value.slice(0, max);
  };

  const name = str("name", 120, true);
  const partnerType = str("partnerType", 40) || "autre";
  if (!PARTNER_TYPES.includes(partnerType as PartnerType)) {
    throw new Error("Type de partenaire inconnu.");
  }

  const commissionType = str("commissionType", 20) || "percent";
  if (commissionType !== "percent" && commissionType !== "fixed") {
    throw new Error("Type de commission inconnu.");
  }
  const commissionValue = Number(raw.commissionValue ?? 0);
  if (!Number.isFinite(commissionValue) || commissionValue < 0) {
    throw new Error("Taux de commission invalide.");
  }
  if (commissionType === "percent" && commissionValue > 100) {
    throw new Error("Un pourcentage de commission ne peut pas dépasser 100 %.");
  }
  if (commissionType === "fixed" && commissionValue > 10000) {
    throw new Error("Montant fixe de commission trop élevé.");
  }

  const commissionDurationType = str("commissionDurationType", 20) || "first_payment";
  if (!["first_payment", "months", "lifetime"].includes(commissionDurationType)) {
    throw new Error("Durée de commission inconnue.");
  }
  let commissionDurationMonths: number | null = null;
  if (commissionDurationType === "months") {
    commissionDurationMonths = Math.floor(Number(raw.commissionDurationMonths ?? 0));
    if (!Number.isFinite(commissionDurationMonths) || commissionDurationMonths < 1 || commissionDurationMonths > 120) {
      throw new Error("Nombre de mois de commission invalide (1 à 120).");
    }
  }

  const plansRaw = Array.isArray(raw.applicablePlans) ? raw.applicablePlans : [];
  const applicablePlans = plansRaw
    .filter((p): p is string => typeof p === "string")
    .filter((p) => ["starter", "pro", "business"].includes(p));

  const attributionWindowDays = Math.floor(Number(raw.attributionWindowDays ?? 30));
  if (!Number.isFinite(attributionWindowDays) || attributionWindowDays < 1 || attributionWindowDays > 365) {
    throw new Error("Durée d'attribution invalide (1 à 365 jours).");
  }

  const toDate = (key: string): string | null => {
    const value = str(key, 40);
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Date invalide : ${key}.`);
    return date.toISOString();
  };
  const startsAt = toDate("startsAt");
  const expiresAt = toDate("expiresAt");
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw new Error("La date de fin doit être postérieure à la date de début.");
  }

  return {
    name,
    companyName: str("companyName", 160),
    partnerType,
    contactName: str("contactName", 120),
    email: str("email", 200).toLowerCase(),
    phone: str("phone", 40),
    address: str("address", 300),
    notes: str("notes", 2000),
    commissionType,
    commissionValue: Math.round(commissionValue * 100) / 100,
    commissionDurationType,
    commissionDurationMonths,
    applicablePlans,
    attributionWindowDays,
    isActive: raw.isActive !== false,
    startsAt,
    expiresAt,
  };
}

function toRow(input: PartnerInput) {
  return {
    name: input.name,
    company_name: input.companyName,
    partner_type: input.partnerType as PartnerType,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
    commission_type: input.commissionType as CommissionType,
    commission_value: input.commissionValue,
    commission_duration_type: input.commissionDurationType as CommissionDurationType,
    commission_duration_months: input.commissionDurationMonths,
    applicable_plans: input.applicablePlans,
    attribution_window_days: input.attributionWindowDays,
    is_active: input.isActive,
    starts_at: input.startsAt,
    expires_at: input.expiresAt,
  };
}

/** Crée un partenaire : code aléatoire + slug lisible générés ici. */
export async function createPartner(
  input: PartnerInput,
  createdBy: string | null
): Promise<MarketingPartnerRow> {
  const admin = createAdminClient();
  const referral_code = await generateUniqueCode();
  const referral_slug = await generateUniqueSlug(input.companyName || input.name);
  const { data, error } = await admin
    .from("marketing_partners")
    .insert({ ...toRow(input), referral_code, referral_slug, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw new Error(`Création du partenaire impossible : ${error.message}`);
  return data as MarketingPartnerRow;
}

/** Met à jour un partenaire (le code et le slug ne changent jamais). */
export async function updatePartner(
  id: string,
  input: PartnerInput
): Promise<MarketingPartnerRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketing_partners")
    .update(toRow(input))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Mise à jour du partenaire impossible : ${error.message}`);
  return data as MarketingPartnerRow;
}

export async function getPartner(id: string): Promise<MarketingPartnerRow | null> {
  const { data, error } = await createAdminClient()
    .from("marketing_partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Lecture du partenaire impossible : ${error.message}`);
  return (data as MarketingPartnerRow | null) ?? null;
}

export async function setPartnerActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await createAdminClient()
    .from("marketing_partners")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw new Error(`Changement de statut impossible : ${error.message}`);
}

/**
 * Suppression : UNIQUEMENT si aucune donnée financière (commission ou
 * relevé de paiement). Sinon l'admin doit désactiver le partenaire.
 * Les clics et attributions du partenaire supprimé partent en cascade.
 */
export async function deletePartner(id: string): Promise<void> {
  const admin = createAdminClient();
  const [commissions, payouts] = await Promise.all([
    admin.from("partner_commissions").select("id", { count: "exact", head: true }).eq("partner_id", id),
    admin.from("partner_payouts").select("id", { count: "exact", head: true }).eq("partner_id", id),
  ]);
  if (commissions.error || payouts.error) {
    throw new Error("Vérification des données financières impossible.");
  }
  if ((commissions.count ?? 0) > 0 || (payouts.count ?? 0) > 0) {
    throw new Error(
      "Ce partenaire a des commissions ou des paiements : il ne peut pas être supprimé. Désactivez-le."
    );
  }
  const { error } = await admin.from("marketing_partners").delete().eq("id", id);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Cagnotte et statistiques — calculées depuis les données réelles     */
/* ------------------------------------------------------------------ */

const EMPTY_BALANCE: PartnerBalance = {
  pendingCents: 0,
  approvedCents: 0,
  payableCents: 0,
  paidCents: 0,
  cancelledCents: 0,
  reversedCents: 0,
  totalEarnedCents: 0,
  grossRevenueCents: 0,
};

interface TotalsRow {
  partner_id: string;
  status: string;
  commissions_count: number;
  total_cents: number;
  gross_cents: number;
}

function foldBalance(rows: TotalsRow[]): PartnerBalance {
  const balance = { ...EMPTY_BALANCE };
  for (const row of rows) {
    const cents = Number(row.total_cents) || 0;
    const gross = Number(row.gross_cents) || 0;
    switch (row.status) {
      case "pending":
        balance.pendingCents += cents;
        break;
      case "approved":
        balance.approvedCents += cents;
        break;
      case "payable":
        balance.payableCents += cents;
        break;
      case "paid":
        balance.paidCents += cents;
        break;
      case "cancelled":
        balance.cancelledCents += cents;
        break;
      case "reversed":
        balance.reversedCents += cents;
        break;
    }
    if (row.status !== "cancelled" && row.status !== "reversed") {
      balance.totalEarnedCents += cents;
      balance.grossRevenueCents += gross;
    }
  }
  return balance;
}

/** Cagnotte d'un partenaire (calculée, jamais stockée). */
export async function getPartnerBalance(partnerId: string): Promise<PartnerBalance> {
  const { data, error } = await createAdminClient()
    .from("partner_commission_totals")
    .select("*")
    .eq("partner_id", partnerId);
  if (error) throw new Error(`Lecture de la cagnotte impossible : ${error.message}`);
  return foldBalance((data ?? []) as TotalsRow[]);
}

/** Cagnottes de plusieurs partenaires en une requête (liste admin). */
export async function getPartnerBalances(
  partnerIds: string[]
): Promise<Map<string, PartnerBalance>> {
  const result = new Map<string, PartnerBalance>();
  if (partnerIds.length === 0) return result;
  const { data, error } = await createAdminClient()
    .from("partner_commission_totals")
    .select("*")
    .in("partner_id", partnerIds);
  if (error) throw new Error(`Lecture des cagnottes impossible : ${error.message}`);
  const byPartner = new Map<string, TotalsRow[]>();
  for (const row of (data ?? []) as TotalsRow[]) {
    const list = byPartner.get(row.partner_id) ?? [];
    list.push(row);
    byPartner.set(row.partner_id, list);
  }
  for (const id of partnerIds) {
    result.set(id, foldBalance(byPartner.get(id) ?? []));
  }
  return result;
}

export interface PartnerFunnel {
  clicks: number;
  signups: number;
  conversions: number;
}

/** Clics / inscriptions / conversions de plusieurs partenaires. */
export async function getPartnerFunnels(
  partnerIds: string[]
): Promise<Map<string, PartnerFunnel>> {
  const result = new Map<string, PartnerFunnel>();
  if (partnerIds.length === 0) return result;
  for (const id of partnerIds) result.set(id, { clicks: 0, signups: 0, conversions: 0 });

  const admin = createAdminClient();
  const [clicks, attributions] = await Promise.all([
    admin.from("partner_clicks").select("partner_id").in("partner_id", partnerIds).limit(100000),
    admin.from("partner_attributions").select("partner_id, status").in("partner_id", partnerIds).limit(100000),
  ]);
  if (clicks.error) throw new Error(`Lecture des clics impossible : ${clicks.error.message}`);
  if (attributions.error) {
    throw new Error(`Lecture des inscriptions impossible : ${attributions.error.message}`);
  }
  for (const row of clicks.data ?? []) {
    const funnel = result.get(row.partner_id as string);
    if (funnel) funnel.clicks += 1;
  }
  for (const row of attributions.data ?? []) {
    const funnel = result.get(row.partner_id as string);
    if (!funnel) continue;
    funnel.signups += 1;
    if ((row.status as string) === "converted") funnel.conversions += 1;
  }
  return result;
}
