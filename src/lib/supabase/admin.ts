import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

/**
 * Client Supabase « admin » (clé secrète, contourne la RLS).
 * Réservé aux routes serveur qui écrivent sans session utilisateur —
 * aujourd'hui uniquement le webhook Stripe (l'appelant est Stripe, pas
 * un utilisateur). Jamais importé par du code client.
 *
 * Variable requise : SUPABASE_SECRET_KEY (sb_secret_…), serveur uniquement.
 */

let admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("Le client admin Supabase ne doit jamais être utilisé côté navigateur.");
  }
  if (!admin) {
    const key = process.env.SUPABASE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error(
        "SUPABASE_SECRET_KEY est absente. Renseignez la clé secrète du projet " +
          "(Supabase → Settings → API Keys → sb_secret_…) dans .env.local — " +
          "serveur uniquement, requise par le webhook Stripe."
      );
    }
    if (key.startsWith("sb_publishable_")) {
      throw new Error(
        "SUPABASE_SECRET_KEY contient une clé publishable. Utilisez la clé secrète (sb_secret_…)."
      );
    }
    const { url } = getSupabaseEnv();
    admin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** true si la clé admin est disponible (le webhook peut écrire en base). */
export const isAdminConfigured =
  typeof process.env.SUPABASE_SECRET_KEY === "string" &&
  process.env.SUPABASE_SECRET_KEY.trim().length > 0;
