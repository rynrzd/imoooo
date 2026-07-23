import { createClient as createBareClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Configuration du site (table `site_settings`) — SERVEUR uniquement.
 *
 * Deux lectures distinctes :
 * - `getSiteSettings()`   : toutes les clés, via la clé secrète (admin).
 * - `getPublicSiteSettings()` : clés d'affichage uniquement (bandeau,
 *   maintenance, e-mail support) via la fonction SQL `public_site_settings`
 *   — utilisable par les layouts SANS clé secrète.
 *
 * JAMAIS de secret dans cette table (clés Stripe/Supabase : .env uniquement).
 */

export interface SiteSettings {
  announcement_message: string;
  maintenance_mode: boolean;
  support_email: string;
  founder_enabled: boolean;
  founder_max_places: number;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  announcement_message: "",
  maintenance_mode: false,
  support_email: "",
  founder_enabled: true,
  founder_max_places: 100,
};

function coerce(raw: Record<string, unknown>): SiteSettings {
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const int = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : d;
  return {
    announcement_message: str(raw.announcement_message, ""),
    maintenance_mode: bool(raw.maintenance_mode, false),
    support_email: str(raw.support_email, ""),
    founder_enabled: bool(raw.founder_enabled, true),
    // Jamais plus de 100 places, quelle que soit la valeur stockée.
    founder_max_places: Math.min(100, Math.max(0, int(raw.founder_max_places, 100))),
  };
}

/** Toutes les clés (admin, clé secrète). Repli silencieux sur les défauts. */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isAdminConfigured) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await createAdminClient().from("site_settings").select("key, value");
    if (error) throw new Error(error.message);
    const raw: Record<string, unknown> = {};
    for (const row of data ?? []) raw[row.key as string] = row.value;
    return coerce(raw);
  } catch (e) {
    logger.error("admin/settings", e);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Clés publiques d'affichage (bandeau d'annonce, maintenance, support).
 * Passe par la fonction SQL sécurisée avec un client SANS cookies : aucune
 * clé secrète requise, les pages publiques restent statiques (elles sont
 * revalidées quand un réglage change). Jamais bloquant (repli défauts).
 */
export async function getPublicSiteSettings(): Promise<
  Pick<SiteSettings, "announcement_message" | "maintenance_mode" | "support_email">
> {
  if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
  try {
    const { url, publishableKey } = getSupabaseEnv();
    const supabase = createBareClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("public_site_settings");
    if (error) throw new Error(error.message);
    return coerce((data as Record<string, unknown>) ?? {});
  } catch (e) {
    logger.error("admin/settings", e);
    return DEFAULT_SETTINGS;
  }
}

/** Écrit une clé (appelé uniquement depuis les Server Actions admin). */
export async function writeSiteSetting(
  key: keyof SiteSettings,
  value: string | number | boolean,
  adminId: string
): Promise<void> {
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert(
      { key, value, updated_by: adminId, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw new Error(`Enregistrement du paramètre impossible : ${error.message}`);
}
