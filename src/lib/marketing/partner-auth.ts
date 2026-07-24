import { cookies } from "next/headers";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Accès self-service au tableau de bord partenaire — SERVEUR uniquement.
 *
 * Le partenaire s'authentifie par un JETON secret (`dashboard_token`,
 * 64 hex ≈ 256 bits), jamais par un compte Supabase. Le jeton est stocké
 * dans un cookie HttpOnly limité au chemin /partenaire. La table
 * marketing_partners est invisible aux clients (RLS révoquée) : seule la
 * clé secrète serveur la lit.
 */

export const PARTNER_COOKIE = "nireo_partner";
/** 30 jours — le partenaire reste connecté sur son appareil. */
export const PARTNER_COOKIE_MAX_AGE = 30 * 86400;

/** Format du jeton (hex uniquement) — filtre les entrées manifestement fausses. */
const TOKEN_FORMAT = /^[a-f0-9]{32,128}$/i;

export interface PartnerAccount {
  id: string;
  name: string;
  companyName: string;
  email: string;
  referralCode: string;
  referralSlug: string;
  commissionType: "percent" | "fixed";
  commissionValue: number;
  isActive: boolean;
  createdAt: string;
}

const PARTNER_COLUMNS =
  "id, name, company_name, email, referral_code, referral_slug, " +
  "commission_type, commission_value, is_active, created_at";

function mapPartner(row: Record<string, unknown>): PartnerAccount {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    companyName: (row.company_name as string) ?? "",
    email: (row.email as string) ?? "",
    referralCode: (row.referral_code as string) ?? "",
    referralSlug: (row.referral_slug as string) ?? "",
    commissionType: (row.commission_type as "percent" | "fixed") ?? "percent",
    commissionValue: Number(row.commission_value) || 0,
    isActive: Boolean(row.is_active),
    createdAt: (row.created_at as string) ?? "",
  };
}

/** Partenaire correspondant à un jeton (null si inconnu). SERVEUR. */
export async function getPartnerByToken(token: string): Promise<PartnerAccount | null> {
  if (!isAdminConfigured) return null;
  const clean = token.trim();
  if (!TOKEN_FORMAT.test(clean)) return null;
  const { data, error } = await createAdminClient()
    .from("marketing_partners")
    .select(PARTNER_COLUMNS)
    .eq("dashboard_token", clean)
    .maybeSingle();
  if (error || !data) return null;
  return mapPartner(data as unknown as Record<string, unknown>);
}

/** Partenaire authentifié via le cookie (null si absent/invalide). */
export async function getAuthenticatedPartner(): Promise<PartnerAccount | null> {
  const token = (await cookies()).get(PARTNER_COOKIE)?.value;
  if (!token) return null;
  return getPartnerByToken(token);
}
