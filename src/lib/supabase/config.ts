/**
 * Configuration Supabase — validée au démarrage.
 *
 * Variables attendues (Projet Supabase → Settings → API) :
 * - NEXT_PUBLIC_SUPABASE_URL              https://PROJECT_REF.supabase.co
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  clé « publishable » (sb_publishable_…)
 * - NEXT_PUBLIC_SITE_URL                  URL du site (redirections d'e-mails)
 *
 * Sans variables Supabase, le démarrage ÉCHOUE — sauf mode démo demandé
 * EXPLICITEMENT via NEXT_PUBLIC_DEMO_MODE=true (données fictives, pas
 * d'authentification). Toute configuration partielle ou invalide interrompt
 * le démarrage avec une erreur explicite — jamais de valeur `undefined`
 * silencieuse, jamais d'application « ouverte » par simple oubli de variable.
 * Les valeurs des clés ne sont jamais affichées dans les logs.
 */

const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const RAW_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const LEGACY_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function fail(message: string): never {
  throw new Error(`Configuration Supabase invalide — ${message}`);
}

/** Valide l'URL du projet : https://PROJECT_REF.supabase.co, sans chemin. */
function validateUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (/\/(rest|auth|storage|realtime|functions)\/v\d/.test(trimmed)) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL ne doit pas contenir de chemin d'API " +
        "(/rest/v1, /auth/v1, /storage/v1…). Utilisez uniquement " +
        "https://PROJECT_REF.supabase.co."
    );
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(trimmed)) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL doit être de la forme " +
        "https://PROJECT_REF.supabase.co (valeur actuelle non conforme)."
    );
  }
  return trimmed;
}

/** Valide la clé côté navigateur : publishable uniquement, jamais une clé secrète. */
function validateKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_secret_")) {
    fail(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contient une clé secrète (sb_secret_…). " +
        "Les clés secrètes ne doivent JAMAIS être exposées au navigateur : " +
        "utilisez la clé « publishable » (sb_publishable_…)."
    );
  }
  if (trimmed.includes("service_role")) {
    fail(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY semble être une clé service_role. " +
        "Utilisez uniquement la clé « publishable » (sb_publishable_…)."
    );
  }
  return trimmed;
}

function resolveConfig(): { url: string; publishableKey: string } | null {
  // L'ancienne variable est définitivement abandonnée : on refuse de démarrer
  // avec, plutôt que de l'utiliser silencieusement.
  if (LEGACY_ANON_KEY && !RAW_KEY) {
    fail(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY n'est plus supportée. Renommez la variable " +
        "en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans votre .env.local."
    );
  }

  if (!RAW_URL && !RAW_KEY) {
    // Le mode démo (données fictives, AUCUNE authentification) doit être un
    // choix explicite : une variable oubliée ne doit jamais ouvrir l'application.
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
      fail(
        "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont absentes. " +
          "Renseignez-les dans .env.local (voir .env.example) — ou définissez " +
          "explicitement NEXT_PUBLIC_DEMO_MODE=true pour un démarrage en mode " +
          "démo (données fictives, sans comptes)."
      );
    }
    if (typeof window === "undefined") {
      console.info(
        "[ImmoPilot] NEXT_PUBLIC_DEMO_MODE=true : démarrage en mode démo (données fictives)."
      );
    }
    return null;
  }

  if (!RAW_URL) {
    fail("NEXT_PUBLIC_SUPABASE_URL est absente alors que la clé est renseignée.");
  }
  if (!RAW_KEY) {
    fail(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est absente alors que l'URL est renseignée."
    );
  }

  return { url: validateUrl(RAW_URL), publishableKey: validateKey(RAW_KEY) };
}

/** Configuration validée (null = mode démo). Évaluée une seule fois au démarrage. */
const CONFIG = resolveConfig();

export const isSupabaseConfigured = CONFIG !== null;

/**
 * URL du site : redirections d'e-mails, métadonnées, sitemap, Stripe.
 * - Défaut : https://immopilot-silk.vercel.app (déploiement de référence).
 * - Production Vercel : NEXT_PUBLIC_SITE_URL est OBLIGATOIRE — le build
 *   échoue avec un message clair plutôt que d'envoyer des liens erronés.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (raw) return raw;
  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL est absente : indispensable en production " +
        "(e-mails d'authentification, sitemap, redirections Stripe). " +
        "Ajoutez-la dans les variables d'environnement Vercel, ex. https://votre-domaine.fr"
    );
  }
  return "https://immopilot-silk.vercel.app";
}

export const SITE_URL = resolveSiteUrl();

/**
 * Retourne la configuration validée.
 * À n'appeler que lorsque `isSupabaseConfigured` est vrai.
 */
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  if (!CONFIG) {
    throw new Error(
      "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.local (voir .env.example)."
    );
  }
  return CONFIG;
}
