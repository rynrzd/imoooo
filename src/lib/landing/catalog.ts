import {
  SECTION_KEYS,
  SLOT_KEYS,
  type LandingCapabilities,
  type SectionKey,
  type SlotDef,
  type SlotKey,
  type SlotPayloadMap,
  type VariantDef,
} from "./types";

/**
 * Landing Intelligence — CATALOGUE DES VARIANTES VALIDÉES.
 *
 * C'est le garde-fou du système : le moteur d'optimisation ne peut servir
 * QUE ce qui est déclaré ici. Aucune génération de texte libre, aucune
 * modification de la page par une IA — uniquement la sélection, la
 * pondération et la combinaison de versions écrites et validées à la main.
 *
 * Ajouter une variante = ajouter un objet dans le tableau du slot concerné.
 * Elle entre immédiatement dans l'expérimentation (poids par défaut) sans
 * migration ni déploiement de schéma.
 */

/* ------------------------------------------------------------------ */
/*  Titres                                                            */
/* ------------------------------------------------------------------ */

/**
 * Titre du hero — FIGÉ.
 *
 * La landing est construite autour de ce hook : trois lignes, la dernière
 * composée dans la typographie éditoriale de la page. Le faire varier
 * reviendrait à casser la mise en page et l'entrée typographique. Le slot
 * reste en place : ajouter un objet dans `variants` relance un test.
 *
 * `lead` peut contenir des retours à la ligne (« \n ») : chaque ligne est
 * rendue séparément et apparaît l'une après l'autre.
 */
const HERO_HEADLINE: SlotDef<"hero_headline"> = {
  key: "hero_headline",
  label: "Titre principal",
  description: "Le premier message vu par le visiteur, en haut de la page.",
  variants: [
    {
      key: "control",
      label: "Ça suffit",
      description: "Nomme le quotidien du bailleur en deux lignes, puis tranche.",
      payload: { lead: "Un loyer sur Excel.\nUn bail dans vos mails.", highlight: "Ça suffit." },
    },
  ],
};

/**
 * Sous-titre du hero — FIGÉ lui aussi.
 *
 * Les variantes longues (« benefit » et « automation ») faisaient tenir le
 * paragraphe sur trois lignes sur mobile et laissaient entendre plus
 * d'automatisme que Nireo n'en fait réellement. Elles sont retirées de
 * l'expérimentation ; il suffit de rajouter un objet dans `variants` pour
 * relancer un test.
 */
const HERO_SUBHEADLINE: SlotDef<"hero_subheadline"> = {
  key: "hero_subheadline",
  label: "Sous-titre",
  description: "La phrase d'explication placée juste sous le titre.",
  variants: [
    {
      key: "control",
      label: "Tout le patrimoine",
      description: "Énumère ce qui est réuni, en une phrase courte et vérifiable.",
      payload: {
        text: "Loyers, baux, locataires et documents. Tout votre patrimoine, enfin au même endroit.",
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Appels à l'action                                                 */
/* ------------------------------------------------------------------ */

/**
 * Boutons du hero. Les libellés visiteur sont figés (ils font partie de la
 * composition du hook) ; la variante « membre » n'est pas une expérience mais
 * un comportement : une session déjà connectée doit repartir vers son
 * tableau de bord, pas vers une inscription.
 */
const HERO_CTA: SlotDef<"hero_cta"> = {
  key: "hero_cta",
  label: "Boutons du hero",
  description: "Libellés et destinations des deux appels à l'action principaux.",
  variants: [
    {
      key: "control",
      label: "Commencer gratuitement",
      description: "Formulation de la landing : créer un compte, ou voir le produit.",
      payload: {
        primary: "Commencer gratuitement",
        href: "/inscription",
        secondary: "Voir Nireo en action",
        secondaryHref: "#produit",
      },
    },
    {
      key: "member",
      label: "Utilisateur connecté",
      description: "Pour une session déjà connectée : retour direct à l'application.",
      payload: {
        primary: "Ouvrir mon tableau de bord",
        href: "/",
        secondary: "Voir Nireo en action",
        secondaryHref: "#produit",
      },
    },
  ],
};

/**
 * Appel à l'action final — FIGÉ.
 *
 * Le bloc de conversion est désormais écrit en dur dans la section bleu nuit
 * (`src/components/landing/final-cta.tsx`) : titre, texte et bouton y forment
 * une composition centrée. Le slot reste déclaré pour ne pas casser les
 * configurations existantes, avec la formulation réellement servie.
 */
const FINAL_CTA: SlotDef<"final_cta"> = {
  key: "final_cta",
  label: "Appel à l'action final",
  description: "Le bloc de conversion en bas de page.",
  variants: [
    {
      key: "control",
      label: "Mieux qu’un tableur",
      description: "Formulation servie par la landing.",
      payload: {
        lead: "Votre patrimoine mérite",
        highlight: "mieux qu’un tableur.",
        text: "Commencez avec votre premier logement et retrouvez enfin une gestion claire.",
        primary: "Créer mon espace gratuit",
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Médias & preuves                                                  */
/* ------------------------------------------------------------------ */

/**
 * Média du hero — FIGÉ : la mise en scène (les pièces administratives qui se
 * rangent dans le tableau de bord) est l'effet signature de la page, elle
 * n'est pas interchangeable avec une capture statique.
 */
const HERO_MEDIA: SlotDef<"hero_media"> = {
  key: "hero_media",
  label: "Média du hero",
  description:
    "Ce qui est montré à côté du titre. Toujours l'interface Nireo : aucune vidéo n'est servie sur la landing.",
  variants: [
    {
      key: "cockpit",
      label: "Tableau de bord",
      description: "Le tableau de bord Nireo, dans lequel viennent se ranger les pièces éparpillées.",
      payload: { kind: "cockpit" },
    },
  ],
};

const PROOF: SlotDef<"proof"> = {
  key: "proof",
  label: "Sécurité & réassurance",
  description: "Le bloc compact qui rassure avant les tarifs.",
  variants: [
    {
      key: "guarantees",
      label: "Engagements réels",
      description: "Hébergement, isolation des données, sauvegardes, gratuit sans carte bancaire.",
      payload: { kind: "guarantees" },
    },
    {
      key: "testimonials",
      label: "Témoignages",
      description:
        "Témoignages RÉELS saisis dans l'administration. Indisponible tant qu'aucun témoignage n'est publié.",
      payload: { kind: "testimonials" },
      requires: "testimonials",
    },
  ],
};

const PRICING_EMPHASIS: SlotDef<"pricing_emphasis"> = {
  key: "pricing_emphasis",
  label: "Mise en avant tarifaire",
  description: "Le plan mis en avant dans la section tarifs.",
  variants: [
    { key: "starter", label: "Starter", description: "Met en avant l'entrée de gamme payante.", payload: { plan: "starter" } },
    { key: "pro", label: "Pro", description: "Met en avant le plan intermédiaire (défaut du produit).", payload: { plan: "pro" } },
    { key: "founder", label: "Offre Fondateur", description: "Met en avant l'offre à vie en tête de section.", payload: { plan: "founder" } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Ordre des sections                                                */
/* ------------------------------------------------------------------ */

/**
 * Ordre des sections — FIGÉ.
 *
 * La landing est une narration continue (le hook, le produit en trois temps,
 * une respiration, le patrimoine réuni, la comparaison, les tarifs, les
 * objections) : intervertir deux sections casserait l'enchaînement et les
 * transitions visuelles. Les clés restent celles d'origine, si bien que les
 * mesures « section vue / temps passé » demeurent comparables.
 */
const ORDER_DEFAULT: SectionKey[] = ["proof", "features", "unify", "pricing", "faq"];

const SECTION_ORDER: SlotDef<"section_order"> = {
  key: "section_order",
  label: "Ordre des sections",
  description: "L'enchaînement narratif de la page. Le hero reste en premier, le CTA final en dernier.",
  variants: [
    {
      key: "default",
      label: "Récit de la landing",
      description:
        "Engagements → produit → patrimoine réuni → tarifs → objections. Ordre servi par la page.",
      payload: { order: ORDER_DEFAULT },
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Registre                                                          */
/* ------------------------------------------------------------------ */

export const LANDING_SLOTS = {
  hero_headline: HERO_HEADLINE,
  hero_subheadline: HERO_SUBHEADLINE,
  hero_cta: HERO_CTA,
  hero_media: HERO_MEDIA,
  proof: PROOF,
  pricing_emphasis: PRICING_EMPHASIS,
  final_cta: FINAL_CTA,
  section_order: SECTION_ORDER,
} as const satisfies { [K in SlotKey]: SlotDef<K> };

/** Slot par clé (jamais indéfini : la clé est typée). */
export function getSlot<K extends SlotKey>(key: K): SlotDef<K> {
  return LANDING_SLOTS[key] as SlotDef<K>;
}

/** Variante par clé, ou `null` si elle n'existe pas (entrée non fiable). */
export function getVariant<K extends SlotKey>(slot: K, variantKey: string): VariantDef<K> | null {
  return (getSlot(slot).variants as VariantDef<K>[]).find((v) => v.key === variantKey) ?? null;
}

/** Variante de référence d'un slot : toujours la première déclarée. */
export function baselineVariant<K extends SlotKey>(slot: K): VariantDef<K> {
  return (getSlot(slot).variants as VariantDef<K>[])[0]!;
}

/** Payload d'une variante, avec repli sur la variante de référence. */
export function payloadOf<K extends SlotKey>(slot: K, variantKey: string): SlotPayloadMap[K] {
  return (getVariant(slot, variantKey) ?? baselineVariant(slot)).payload;
}

/** true si le contenu externe requis par la variante est réellement présent. */
export function isVariantEligible(variant: VariantDef, capabilities: LandingCapabilities): boolean {
  if (!variant.requires) return true;
  if (variant.requires === "video") return Boolean(capabilities.videoUrl);
  return capabilities.testimonials.length >= 2;
}

/** Variantes réellement servables d'un slot (au moins la référence). */
export function eligibleVariants<K extends SlotKey>(
  slot: K,
  capabilities: LandingCapabilities,
  disabled: string[] = []
): VariantDef<K>[] {
  const all = getSlot(slot).variants as VariantDef<K>[];
  const usable = all.filter(
    (v) => isVariantEligible(v, capabilities) && !disabled.includes(`${slot}:${v.key}`)
  );
  return usable.length > 0 ? usable : [all[0]!];
}

/** L'ordre des sections d'origine — repli universel. */
export function defaultSectionOrder(): SectionKey[] {
  return [...ORDER_DEFAULT];
}

/**
 * Valide un ordre de sections : ce doit être une permutation EXACTE des
 * sections connues. Toute liste incomplète ou fantaisiste est rejetée —
 * jamais de section perdue à cause d'une recommandation mal formée.
 */
export function isValidSectionOrder(order: unknown): order is SectionKey[] {
  if (!Array.isArray(order) || order.length !== SECTION_KEYS.length) return false;
  const seen = new Set(order);
  if (seen.size !== SECTION_KEYS.length) return false;
  return SECTION_KEYS.every((k) => seen.has(k));
}

/** Toutes les clés de slots, dans l'ordre d'affichage de l'administration. */
export const SLOT_ORDER: readonly SlotKey[] = SLOT_KEYS;
