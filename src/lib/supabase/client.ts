import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";
import {
  adjustPersistence,
  REMEMBER_COOKIE,
  rememberFromCookies,
  type PersistenceOptions,
} from "./session-persistence";

/** Instance unique du client navigateur (partagée par toute l'application). */
let browserClient: SupabaseClient | undefined;

/** Lecture brute des cookies du document (valeurs Supabase = base64url, sûres). */
function readDocumentCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split("; ").filter(Boolean).map((pair) => {
    const eq = pair.indexOf("=");
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
}

/** Sérialise un cookie sans ré-encoder la valeur (symétrique de la lecture). */
function serializeCookie(
  name: string,
  value: string,
  options: PersistenceOptions & {
    path?: string;
    domain?: string;
    sameSite?: string | boolean;
    secure?: boolean;
  }
): string {
  const parts = [`${name}=${value}`, `Path=${options.path ?? "/"}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  const sameSite = typeof options.sameSite === "string" ? options.sameSite : "lax";
  parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Enregistre la préférence « rester connecté » (cookie first-party, lu aussi
 * par le proxy serveur). À appeler AVANT signInWithPassword pour que la
 * session soit écrite avec la bonne durée dès la connexion.
 */
export function setRememberSession(remember: boolean): void {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

/** Client Supabase côté navigateur (composants client), instance unique. */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = getSupabaseEnv();
    browserClient = createBrowserClient(url, publishableKey, {
      cookies: {
        getAll() {
          return readDocumentCookies();
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          // La durée des cookies Auth suit la préférence « rester connecté » :
          // persistante par défaut, éphémère (cookie de session) si décochée.
          const remember = rememberFromCookies(readDocumentCookies());
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookie(
              name,
              value,
              adjustPersistence(options ?? {}, remember)
            );
          });
        },
      },
    });
  }
  return browserClient;
}
