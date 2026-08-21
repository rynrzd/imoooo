/**
 * Supervision des erreurs — destination unique, branchée sur `logger`.
 *
 * Ce module ne remplace rien : `src/lib/logger.ts` reste le seul point
 * d'appel du code métier. Il lui ajoute ce qui manquait — une sortie qui
 * survit à la requête. Jusqu'ici tout finissait dans `console` : côté
 * serveur, les journaux Vercel s'effacent au bout de quelques jours ; côté
 * navigateur, ils ne quittaient jamais la machine de l'utilisateur. Une
 * erreur vécue par un client était donc, littéralement, invisible.
 *
 * Aucune dépendance n'est ajoutée : l'événement part en JSON vers un
 * collecteur HTTP quelconque (Sentry via un relais, Better Stack, Axiom,
 * Logtail, Discord/Slack…). Le format est décrit dans `MonitoringEvent`.
 *
 * ┌─ CONFIGURATION (une seule variable, serveur) ─────────────────────┐
 * │ MONITORING_WEBHOOK_URL = https://…                                │
 * │   Absente → supervision INACTIVE, et c'est dit explicitement par  │
 * │   /api/health. Aucune clé n'est inventée, aucun envoi simulé.     │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Deux règles tenues ici, et pas ailleurs :
 *  1. RIEN DE SENSIBLE NE SORT. Le message est expurgé avant l'envoi
 *     (jetons, clés, cookies, mots de passe, adresses e-mail, URL signées).
 *     La liste vit dans `redact` — c'est le seul endroit à relire.
 *  2. LA SUPERVISION NE CASSE JAMAIS L'APPLICATION. Tout échec d'envoi est
 *     avalé, et un envoi ne peut pas déclencher un nouvel envoi (boucle).
 */

export type MonitoringLevel = "error" | "warn" | "info";

export interface MonitoringEvent {
  level: MonitoringLevel;
  /** Domaine fonctionnel : `stripe/webhook`, `app/error-boundary`… */
  scope: string;
  message: string;
  stack?: string;
  /** « production » | « preview » | « development ». */
  environment: string;
  /** Commit déployé — indispensable pour relier une erreur à une version. */
  release: string;
  /** Origine de l'événement. */
  runtime: "server" | "browser";
  /** Chemin de la page (navigateur uniquement, sans query string). */
  path?: string;
  timestamp: string;
}

const WEBHOOK = process.env.MONITORING_WEBHOOK_URL?.trim() ?? "";

/** true si un collecteur est réellement configuré. */
export const isMonitoringConfigured = WEBHOOK.length > 0;

export const MONITORING_ENVIRONMENT =
  process.env.VERCEL_ENV?.trim() ||
  process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
  process.env.NODE_ENV ||
  "development";

export const MONITORING_RELEASE = (
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  "local"
).slice(0, 12);

/**
 * Expurgation — appliquée à TOUT texte sortant (message et pile).
 *
 * L'ordre compte : les motifs les plus spécifiques (clés reconnaissables à
 * leur préfixe) passent avant les plus généraux, sinon un motif large
 * masquerait la forme exacte et rendrait le diagnostic impossible.
 *
 * On remplace par une étiquette PARLANTE (`[clé-stripe]`) plutôt que par des
 * étoiles : savoir QUEL type de secret apparaissait dans un message est
 * souvent la moitié du diagnostic — sans jamais révéler la valeur.
 */
const REDACTIONS: [RegExp, string][] = [
  // Clés et secrets, reconnus à leur préfixe.
  [/sb_secret_[A-Za-z0-9_-]+/g, "[clé-supabase-secrète]"],
  [/sb_publishable_[A-Za-z0-9_-]+/g, "[clé-supabase-publique]"],
  [/\b[sr]k_(?:live|test)_[A-Za-z0-9]+/g, "[clé-stripe]"],
  [/whsec_[A-Za-z0-9_-]+/g, "[secret-webhook]"],
  [/\bre_[A-Za-z0-9_-]{16,}/g, "[clé-resend]"],
  // Jeton JWT (session Supabase).
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jeton-jwt]"],
  // En-têtes et cookies portant une valeur.
  [/(authorization|bearer)\s*[:=]?\s*\S+/gi, "$1 [expurgé]"],
  [/(cookie|set-cookie)\s*[:=]\s*[^\s;]+/gi, "$1=[expurgé]"],
  [/(sb-[a-z0-9]+-auth-token)[^\s;]*/gi, "$1=[expurgé]"],
  // Mot de passe passé dans un objet sérialisé ou une chaîne de connexion.
  [/("?password"?\s*[:=]\s*)("[^"]*"|\S+)/gi, "$1[expurgé]"],
  [/:\/\/[^:@/\s]+:[^@/\s]+@/g, "://[identifiants]@"],
  // URL signée du Storage : le jeton donne accès au fichier.
  [/([?&]token=)[^&\s]+/gi, "$1[expurgé]"],
  // Adresse e-mail : donnée personnelle, jamais nécessaire au diagnostic.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mail]"],
];

/** Texte débarrassé de tout secret ou donnée personnelle, et borné. */
export function redact(input: string, maxLength = 2000): string {
  let out = input;
  for (const [pattern, replacement] of REDACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out.length > maxLength ? `${out.slice(0, maxLength)}…` : out;
}

/**
 * Garde-fou anti-boucle : si l'envoi échoue et que cet échec était
 * journalisé, chaque erreur en engendrerait une nouvelle, indéfiniment.
 */
let sending = false;
/** L'indisponibilité du collecteur n'est signalée qu'UNE fois par instance. */
let deliveryFailureLogged = false;

/** Envoi effectif (serveur). Ne lève jamais. */
async function deliver(event: MonitoringEvent): Promise<void> {
  if (!isMonitoringConfigured || sending) return;
  sending = true;
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      // La supervision ne doit jamais retarder une réponse utilisateur.
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    if (!deliveryFailureLogged) {
      deliveryFailureLogged = true;
      // `console` directement : passer par `logger` reboucherait ici.
      console.error(
        "[monitoring] collecteur injoignable — les erreurs restent dans les journaux :",
        e instanceof Error ? e.message : String(e)
      );
    }
  } finally {
    sending = false;
  }
}

/**
 * Enregistre un événement. Appelé UNIQUEMENT par `logger` — le code métier
 * ne s'adresse jamais directement à ce module.
 *
 * Côté navigateur, l'événement est relayé par `/api/monitoring/report` :
 * l'URL du collecteur (et donc son éventuel jeton) ne descend jamais dans
 * le bundle client.
 */
export function captureEvent(
  level: MonitoringLevel,
  scope: string,
  message: string,
  stack?: string
): void {
  // `info` n'est pas une anomalie : on ne remplit pas la supervision avec.
  if (level === "info") return;

  const event: MonitoringEvent = {
    level,
    scope: redact(scope, 120),
    message: redact(message),
    ...(stack ? { stack: redact(stack, 4000) } : {}),
    environment: MONITORING_ENVIRONMENT,
    release: MONITORING_RELEASE,
    runtime: typeof window === "undefined" ? "server" : "browser",
    ...(typeof window !== "undefined" ? { path: window.location.pathname } : {}),
    timestamp: new Date().toISOString(),
  };

  if (typeof window === "undefined") {
    void deliver(event);
    return;
  }

  // Navigateur : `keepalive` pour que l'envoi survive à la navigation qui
  // suit souvent une erreur. Aucun échec n'est remonté à l'utilisateur.
  try {
    void fetch("/api/monitoring/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Navigateur sans fetch disponible : rien à faire, l'erreur reste en console.
  }
}

/** Réception d'un événement venu du navigateur : re-expurgé puis transmis. */
export async function captureFromBrowser(raw: unknown): Promise<void> {
  if (!isMonitoringConfigured) return;
  const input = (raw ?? {}) as Partial<MonitoringEvent>;
  const level: MonitoringLevel = input.level === "warn" ? "warn" : "error";
  const event: MonitoringEvent = {
    level,
    // Le navigateur n'est pas une source de confiance : on ré-expurge et on
    // borne tout ce qu'il envoie, exactement comme une entrée utilisateur.
    scope: redact(String(input.scope ?? "browser"), 120),
    message: redact(String(input.message ?? "")),
    ...(input.stack ? { stack: redact(String(input.stack), 4000) } : {}),
    environment: MONITORING_ENVIRONMENT,
    release: MONITORING_RELEASE,
    runtime: "browser",
    ...(input.path ? { path: redact(String(input.path), 200) } : {}),
    timestamp: new Date().toISOString(),
  };
  await deliver(event);
}
