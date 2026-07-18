import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

/**
 * Client Supabase côté serveur (Server Components, Route Handlers,
 * Server Actions). Créé par requête : les cookies portent la session.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Appelé depuis un Server Component : les cookies sont
          // rafraîchis par le proxy, on peut ignorer l'écriture ici.
        }
      },
    },
  });
}
