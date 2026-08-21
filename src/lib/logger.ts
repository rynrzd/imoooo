/**
 * Journalisation centralisée — et point de sortie unique de la supervision.
 *
 * `report` fait maintenant deux choses : la trace `console` (inchangée,
 * lisible dans les journaux Vercel) ET l'envoi vers le collecteur d'erreurs
 * quand `MONITORING_WEBHOOK_URL` est configurée (voir src/lib/monitoring.ts).
 * Sans cette variable, le comportement est EXACTEMENT celui d'avant : rien
 * n'est envoyé, rien n'est simulé.
 *
 * Aucun appelant n'a changé : c'était tout l'intérêt d'avoir un seul point.
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

import { captureEvent } from "./monitoring";

type Scope = string;

function report(level: "error" | "warn" | "info", scope: Scope, detail: unknown): void {
  const message = detail instanceof Error ? detail.message : String(detail);
  // La pile n'est lue que pour la supervision : elle n'est jamais affichée
  // à l'utilisateur, et jamais écrite dans la console (déjà bruyante).
  const stack = detail instanceof Error ? detail.stack : undefined;

  if (level === "error") {
    console.error(`[${scope}]`, message);
  } else if (level === "warn") {
    console.warn(`[${scope}]`, message);
  } else {
    console.info(`[${scope}]`, message);
  }

  // Sortie durable. Ne lève jamais : une supervision en panne ne doit pas
  // transformer une erreur journalisée en erreur fatale.
  try {
    captureEvent(level, scope, message, stack);
  } catch {
    // silencieux, par construction.
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
