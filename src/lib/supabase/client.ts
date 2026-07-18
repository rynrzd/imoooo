import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

/** Instance unique du client navigateur (partagée par toute l'application). */
let browserClient: SupabaseClient | undefined;

/** Client Supabase côté navigateur (composants client). */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = getSupabaseEnv();
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
