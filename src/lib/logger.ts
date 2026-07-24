/**
 * Journalisation centralisée — AUCUN service tiers connecté.
 *
 * Point de branchement unique pour un futur monitoring (ex. Sentry) :
 * le jour venu, installer le SDK et l'appeler dans `report`, sans
 * toucher aux appelants.
 *
 * Événements utiles à surveiller en production :
 * - auth/*      : échecs d'authentification, callback en erreur
 * - stripe/*    : checkout, portail, webhook, synchronisation
 * - storage/*   : uploads / suppressions de fichiers échoués
 * - supabase/*  : erreurs de requêtes base de données
 * - app/*       : error boundary, routes API en échec
 *
 * Règles : jamais de données personnelles, de clés, d'URL signées ni de
 * contenu de document dans les messages. Le scope suffit au diagnostic.
 */

type Scope = string;

function report(level: "error" | "warn" | "info", scope: Scope, detail: unknown): void {
  // Branchement futur (Sentry, Logtail…) : ici, et uniquement ici.
  const message = detail instanceof Error ? detail.message : String(detail);
  if (level === "error") {
    console.error(`[${scope}]`, message);
  } else if (level === "warn") {
    console.warn(`[${scope}]`, message);
  } else {
    console.info(`[${scope}]`, message);
  }
}

export const logger = {
  error(scope: Scope, detail: unknown): void {
    report("error", scope, detail);
  },
  warn(scope: Scope, detail: unknown): void {
    report("warn", scope, detail);
  },
  info(scope: Scope, detail: unknown): void {
    report("info", scope, detail);
  },
};
