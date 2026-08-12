/**
 * TUNNEL D'ACQUISITION — point d'entrée UNIQUE et typé.
 *
 * Parcours mesuré : landing → clic sur un appel à l'action → inscription →
 * premier logement. Sept événements, sept noms canoniques, un seul module.
 *
 * AUCUN outil externe n'est ajouté : tout passe par la mesure first-party déjà
 * en place (`/api/landing/collect`, table `landing_events`, cookie visiteur
 * HttpOnly posé par le proxy). PostHog, Google Analytics & co. ne sont pas
 * installés et ne le sont pas ici.
 *
 * ── Transport ────────────────────────────────────────────────────────────
 * Quatre des sept événements sont DÉJÀ émis par l'instrumentation existante :
 * les réémettre créerait des doublons en base (et fausserait les vues SQL du
 * moteur, qui comptent les `cta_click` par session). `trackFunnel` connaît ce
 * partage et n'envoie que ce qui manque réellement :
 *
 *   landing_view              → `exposure`, émis au montage par LandingTracker
 *   landing_primary_cta_click → `cta_click`, émis par la délégation de clic du
 *                               tracker sur [data-lx-cta] (élément = marqueur
 *                               `CTA_MARKER` ci-dessous)
 *   landing_product_cta_click → idem, marqueur « product-cta »
 *   signup_completed          → écrit par le SERVEUR (layout applicatif), à
 *                               partir d'une session Supabase vérifiée : le
 *                               navigateur ne peut pas déclarer une fausse
 *                               inscription
 *   signup_started            → ENVOYÉ ICI (depuis /inscription)
 *   first_property_started    → ENVOYÉ ICI
 *   first_property_created    → ENVOYÉ ICI
 *
 * Appeler `trackFunnel` reste utile pour les quatre premiers : c'est ce qui
 * rend le tunnel lisible en développement, et le jour où un outil est branché,
 * il suffira de le brancher dans `send()` — tous les points d'appel sont déjà
 * posés, aucun composant à retoucher.
 *
 * ── Ce qui est transmis ──────────────────────────────────────────────────
 * L'emplacement du CTA (`hero`, `product_preview`, `final_cta`,
 * `mobile_menu`), le plan initial (`free`) et rien d'autre côté client.
 * L'appareil (mobile / tablette / bureau), la source UTM normalisée, le pays
 * et le segment sont ajoutés PAR LE SERVEUR à partir du profil visiteur : ils
 * sont ainsi fiables (non falsifiables) et jamais dupliqués.
 *
 * JAMAIS transmis : e-mail, nom, adresse d'un logement, montant, document,
 * identifiant de compte, coordonnée absolue de clic.
 */

import type { PlanId } from "@/config/plans";

/* ------------------------------------------------------------------ */
/*  Vocabulaire                                                       */
/* ------------------------------------------------------------------ */

export const FUNNEL_EVENTS = [
  "landing_view",
  "landing_primary_cta_click",
  "landing_product_cta_click",
  "signup_started",
  "signup_completed",
  "first_property_started",
  "first_property_created",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Emplacements d'appel à l'action du tunnel. */
export type CtaLocation = "hero" | "product_preview" | "final_cta" | "mobile_menu";

/**
 * Marqueur `data-lx` porté par chaque appel à l'action principal.
 *
 * Les valeurs sont celles qui existaient déjà (« hero-cta-primary »,
 * « final-cta-primary », « menu-cta ») : les statistiques par élément restent
 * comparables d'un mois sur l'autre. Seul « product-cta » est nouveau.
 * Centraliser ces chaînes ici évite qu'un composant et une requête d'analyse
 * divergent silencieusement.
 */
export const CTA_MARKER: Record<CtaLocation, string> = {
  hero: "hero-cta-primary",
  product_preview: "product-cta",
  final_cta: "final-cta-primary",
  mobile_menu: "menu-cta",
};

/** Propriétés non sensibles admises. Toute autre clé est impossible (typée). */
export interface FunnelProps {
  /** Où se trouvait l'appel à l'action cliqué. */
  location?: CtaLocation;
  /** Plan du compte au moment de l'événement — « free » pour tout nouveau compte. */
  plan?: PlanId;
  /** Élément à l'origine de l'événement (jamais une donnée saisie). */
  element?: string;
}

/* ------------------------------------------------------------------ */
/*  Transport                                                         */
/* ------------------------------------------------------------------ */

const ENDPOINT = "/api/landing/collect";

/**
 * Événements déjà émis ailleurs (cf. tableau en tête de fichier) : ce module
 * ne les renvoie pas, sous peine de doubler les lignes en base.
 */
const AMBIENT: ReadonlySet<FunnelEvent> = new Set<FunnelEvent>([
  "landing_view",
  "landing_primary_cta_click",
  "landing_product_cta_click",
  "signup_completed",
]);

/**
 * Anti-doublon : une clé « événement|emplacement » n'est envoyée qu'une fois
 * par chargement de page. Indispensable avec React Strict Mode, qui monte
 * puis remonte chaque composant en développement, et suffisant pour un double
 * clic sur un bouton.
 */
const sent = new Set<string>();

/** Identifiant de session du tracker de la landing (aucune donnée perso). */
function sessionId(): string {
  try {
    return sessionStorage.getItem("nireo_l_sid") ?? "";
  } catch {
    return "";
  }
}

function send(event: FunnelEvent, props: FunnelProps): void {
  const body = JSON.stringify({
    sessionId: sessionId(),
    path: window.location.pathname,
    events: [
      {
        type: event,
        element: props.element ?? (props.location ? CTA_MARKER[props.location] : undefined),
        plan: props.plan,
      },
    ],
  });
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // silencieux : la mesure ne doit jamais gêner le parcours.
  }
}

/**
 * Enregistre une étape du tunnel. Sans effet côté serveur (rendu SSR) et
 * jamais bloquant : aucune attente, aucune erreur remontée à l'utilisateur.
 */
export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): void {
  if (typeof window === "undefined") return;

  const key = `${event}|${props.location ?? props.element ?? ""}`;
  if (sent.has(key)) return;
  sent.add(key);

  if (process.env.NODE_ENV === "development") {
    console.debug("[funnel]", event, props, AMBIENT.has(event) ? "(déjà mesuré)" : "");
  }

  if (AMBIENT.has(event)) return;
  send(event, props);
}
