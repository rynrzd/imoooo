/**
 * Couche analytics minimale — AUCUN service tiers connecté.
 * Les événements sont gardés en mémoire (et logués en développement) ;
 * le jour où un outil est choisi (Plausible, PostHog…), il suffit de
 * brancher son SDK dans `track` sans toucher aux appelants.
 */

export type AnalyticsEvent =
  | "cta_essai_gratuit"
  | "cta_connexion"
  | "vue_tarifs"
  | "inscription_commencee";

interface QueuedEvent {
  name: AnalyticsEvent;
  /** Contexte facultatif (ex. : emplacement du bouton). */
  meta?: Record<string, string>;
  at: string;
}

const queue: QueuedEvent[] = [];

export function track(name: AnalyticsEvent, meta?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  queue.push({ name, meta, at: new Date().toISOString() });
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", name, meta ?? {});
  }
}

/** File des événements en attente (utile pour brancher un outil plus tard). */
export function pendingEvents(): readonly QueuedEvent[] {
  return queue;
}
