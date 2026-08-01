/**
 * Landing Intelligence — types du moteur.
 *
 * Vocabulaire :
 * - SLOT     : un emplacement variable de la page (titre, sous-titre, CTA,
 *              média du hero, preuve sociale, mise en avant tarifaire, ordre
 *              des sections…).
 * - VARIANTE : une version VALIDÉE d'un slot, déclarée dans le catalogue
 *              (`catalog.ts`). L'IA ne rédige jamais de contenu libre : elle
 *              ne fait que choisir, pondérer et combiner des variantes
 *              existantes — la marque, le SEO et la cohérence sont préservés.
 * - SEGMENT  : le profil d'audience détecté côté serveur (source de trafic,
 *              visiteur connu, membre connecté…).
 * - CONFIG   : l'état actif du moteur (poids, épinglages, règles, ordre).
 */

/* ------------------------------------------------------------------ */
/*  Sections de la landing                                            */
/* ------------------------------------------------------------------ */

/**
 * Sections réordonnables. Le hero est toujours en premier et le CTA final
 * toujours en dernier : ils ne font pas partie de la liste réordonnable.
 */
export const SECTION_KEYS = [
  "trust",
  "before_after",
  "demo",
  "features",
  "day",
  "proof",
  "pricing",
  "company",
  "faq",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  trust: "Bandeau de confiance",
  before_after: "Avant / Après",
  demo: "Démonstration",
  features: "Fonctionnalités",
  day: "Une journée avec Nireo",
  proof: "Preuve & réassurance",
  pricing: "Tarifs",
  company: "L'entreprise",
  faq: "FAQ",
};

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/*  Slots                                                             */
/* ------------------------------------------------------------------ */

export const SLOT_KEYS = [
  "hero_headline",
  "hero_subheadline",
  "hero_cta",
  "hero_media",
  "proof",
  "pricing_emphasis",
  "final_cta",
  "section_order",
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

export function isSlotKey(value: unknown): value is SlotKey {
  return typeof value === "string" && (SLOT_KEYS as readonly string[]).includes(value);
}

/* ------------------------------ Payloads --------------------------- */

/** Titre principal : le mot-clé mis en valeur est isolé pour le rendu. */
export interface HeadlinePayload {
  lead: string;
  highlight: string;
}

export interface SubheadlinePayload {
  text: string;
}

export interface CtaPayload {
  /** Libellé du bouton principal. */
  primary: string;
  /** Destination du bouton principal (toujours une route interne). */
  href: string;
  /** Libellé du lien secondaire. */
  secondary: string;
  /** Destination du lien secondaire (ancre ou route interne). */
  secondaryHref: string;
}

/** Média du hero : composition produit, vidéo réelle, ou aperçu d'écran. */
export interface MediaPayload {
  kind: "cockpit" | "video" | "preview";
}

/** Bloc de réassurance : garanties produit, chiffres, ou vrais témoignages. */
export interface ProofPayload {
  kind: "guarantees" | "figures" | "testimonials";
}

export interface PricingEmphasisPayload {
  /** Plan mis en avant dans la section tarifs. */
  plan: "starter" | "pro" | "founder";
}

export interface FinalCtaPayload {
  lead: string;
  highlight: string;
  text: string;
  primary: string;
}

export interface SectionOrderPayload {
  order: SectionKey[];
}

/** Association slot → forme de son payload. */
export interface SlotPayloadMap {
  hero_headline: HeadlinePayload;
  hero_subheadline: SubheadlinePayload;
  hero_cta: CtaPayload;
  hero_media: MediaPayload;
  proof: ProofPayload;
  pricing_emphasis: PricingEmphasisPayload;
  final_cta: FinalCtaPayload;
  section_order: SectionOrderPayload;
}

/**
 * Contenu externe dont une variante peut dépendre. Si la capacité est
 * absente, la variante n'est JAMAIS servie (pas de bloc vide, pas de faux
 * contenu) et sort automatiquement de l'expérimentation.
 */
export type CapabilityKey = "video" | "testimonials";

export interface LandingCapabilities {
  /** URL de la vidéo de présentation publiée depuis /admin/entreprise. */
  videoUrl: string | null;
  /** Témoignages réels saisis dans l'administration (jamais inventés). */
  testimonials: Testimonial[];
}

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

export interface VariantDef<K extends SlotKey = SlotKey> {
  key: string;
  label: string;
  /** À quoi sert cette variante — affiché dans l'administration. */
  description: string;
  payload: SlotPayloadMap[K];
  /** Contenu externe requis pour que la variante soit éligible. */
  requires?: CapabilityKey;
}

export interface SlotDef<K extends SlotKey = SlotKey> {
  key: K;
  label: string;
  description: string;
  variants: VariantDef<K>[];
}

/* ------------------------------------------------------------------ */
/*  Audience                                                          */
/* ------------------------------------------------------------------ */

export const SEGMENT_KEYS = [
  "member",
  "partner",
  "qr",
  "tiktok",
  "facebook",
  "linkedin",
  "google",
  "other",
  "returning",
  "direct",
] as const;

export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  member: "Utilisateur connecté",
  partner: "Partenaire",
  qr: "QR Code",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  google: "Google",
  other: "Autre site",
  returning: "Visiteur déjà venu",
  direct: "Accès direct",
};

export function isSegmentKey(value: unknown): value is SegmentKey {
  return typeof value === "string" && (SEGMENT_KEYS as readonly string[]).includes(value);
}

export type DeviceKey = "mobile" | "tablet" | "desktop";

/** Profil du visiteur, entièrement déduit CÔTÉ SERVEUR. Aucune donnée perso. */
export interface VisitorProfile {
  /** Identifiant aléatoire de cookie (jamais dérivé de l'IP ni d'un compte). */
  visitorId: string;
  segment: SegmentKey;
  /** Source brute normalisée (utile pour les stats, distincte du segment). */
  source: string;
  device: DeviceKey;
  country: string | null;
  language: string;
  isReturning: boolean;
  isAuthenticated: boolean;
  visitCount: number;
  /** Code partenaire attribué (jamais affiché tel quel). */
  partnerRef: string | null;
}

/* ------------------------------------------------------------------ */
/*  Configuration du moteur                                           */
/* ------------------------------------------------------------------ */

/**
 * Règle de personnalisation : « pour ce profil, servir cette variante ».
 * `segment: "any"` cible tous les visiteurs (utile pour une règle purement
 * liée à l'appareil, par exemple « sur mobile, remonter les tarifs »).
 */
export interface SegmentRule {
  segment: SegmentKey | "any";
  /** Restriction d'appareil facultative. */
  device?: DeviceKey | null;
  slot: SlotKey;
  variant: string;
  /** Origine de la règle : posée à la main ou issue d'une recommandation. */
  origin?: "default" | "manual" | "recommendation";
}

/** Une règle plus précise l'emporte toujours sur une règle plus large. */
export function ruleSpecificity(rule: SegmentRule): number {
  return (rule.segment === "any" ? 0 : 2) + (rule.device ? 1 : 0);
}

/** true si la règle s'applique à ce profil. */
export function ruleMatches(
  rule: SegmentRule,
  profile: Pick<VisitorProfile, "segment" | "device">
): boolean {
  if (rule.segment !== "any" && rule.segment !== profile.segment) return false;
  if (rule.device && rule.device !== profile.device) return false;
  return true;
}

export interface LandingConfig {
  /** Numéro de version — incrémenté à chaque application. */
  version: number;
  /** Le moteur ajuste-t-il seul les poids à partir des résultats réels ? */
  autopilot: boolean;
  /**
   * Part de trafic minimale GARANTIE à chaque variante active : le moteur
   * n'arrête jamais complètement une variante, il continue d'apprendre.
   */
  explorationFloor: number;
  /**
   * Part des sessions d'un segment qui IGNORE volontairement les règles de
   * personnalisation. Sans ce témoin, il serait impossible de mesurer si la
   * personnalisation apporte réellement quelque chose.
   */
  ruleHoldout: number;
  /** Poids d'exposition par slot : { hero_headline: { control: 0.4, … } }. */
  weights: Partial<Record<SlotKey, Record<string, number>>>;
  /** Variante figée pour tout le monde (arrête l'expérimentation du slot). */
  pins: Partial<Record<SlotKey, string>>;
  /** Personnalisation par segment. */
  rules: SegmentRule[];
  /** Variantes désactivées, au format « slot:variant ». */
  disabled: string[];
  /**
   * Ordres de sections composés par le moteur (au-delà du catalogue).
   * Toujours validés : permutation exacte des sections connues.
   */
  customOrders: Record<string, SectionKey[]>;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Résolution                                                        */
/* ------------------------------------------------------------------ */

export interface LandingContent {
  headline: HeadlinePayload;
  subheadline: SubheadlinePayload;
  cta: CtaPayload;
  media: MediaPayload;
  proof: ProofPayload;
  pricingEmphasis: PricingEmphasisPayload;
  finalCta: FinalCtaPayload;
  sections: SectionKey[];
}

export interface LandingResolution {
  content: LandingContent;
  /** Combinaison servie : { slot: variantKey }. Envoyée telle quelle au suivi. */
  assignments: Record<string, string>;
  profile: VisitorProfile;
  configVersion: number;
  /** true si au moins une règle de personnalisation a été appliquée. */
  personalized: boolean;
}

/* ------------------------------------------------------------------ */
/*  Événements                                                        */
/* ------------------------------------------------------------------ */

export const CLIENT_EVENT_TYPES = [
  "exposure",
  "engage",
  "scroll",
  "section_view",
  "section_dwell",
  "click",
  "cta_click",
  "video_play",
  "video_progress",
  "exit",
  "signup_started",
  "plan_selected",
] as const;

export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

/** Conversions écrites par le SERVEUR uniquement (jamais depuis le client). */
export type ServerEventType = "signup_completed" | "payment_started" | "payment_success";

export type LandingEventType = ClientEventType | ServerEventType;

export function isClientEventType(value: unknown): value is ClientEventType {
  return typeof value === "string" && (CLIENT_EVENT_TYPES as readonly string[]).includes(value);
}
