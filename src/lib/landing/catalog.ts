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
 * Titres du hero. `lead` peut contenir des retours à la ligne (« \n ») :
 * chaque ligne est rendue séparément et apparaît l'une après l'autre. Seul
 * `highlight` reçoit le dégradé bleu/violet — jamais tout le titre.
 */
const HERO_HEADLINE: SlotDef<"hero_headline"> = {
  key: "hero_headline",
  label: "Titre principal",
  description: "Le premier message vu par le visiteur, en haut de la page.",
  variants: [
    {
      key: "control",
      label: "Ça suffit",
      description: "Nomme le quotidien du bailleur en deux lignes, puis tranche — référence de comparaison.",
      payload: { lead: "Un loyer sur Excel.\nUn bail dans vos mails.", highlight: "Ça suffit." },
    },
    {
      key: "clarity",
      label: "Au même endroit",
      description: "Met en avant le bénéfice : tout se retrouve dans un seul espace.",
      payload: { lead: "Vos loyers, vos baux,\nvos factures.", highlight: "Au même endroit." },
    },
    {
      key: "problem",
      label: "Recherche de documents",
      description: "Nomme la douleur la plus concrète : retrouver un document.",
      payload: { lead: "Chercher un bail\ndans ses mails.", highlight: "C’est terminé." },
    },
    {
      key: "mobile",
      label: "Mobile",
      description: "Formulation courte et directe, pensée pour les arrivées réseaux sociaux.",
      payload: { lead: "Toute votre gestion\nlocative.", highlight: "Dans un seul espace." },
    },
  ],
};

/**
 * Sous-titre du hero — volontairement FIGÉ sur une seule phrase.
 *
 * Les deux variantes longues (« benefit » et « automation ») faisaient tenir
 * le paragraphe sur trois lignes sur mobile et laissaient entendre plus
 * d'automatisme que Nireo n'en fait réellement. Elles sont retirées de
 * l'expérimentation ; le slot reste en place, il suffit de rajouter un objet
 * dans `variants` pour relancer un test.
 */
const HERO_SUBHEADLINE: SlotDef<"hero_subheadline"> = {
  key: "hero_subheadline",
  label: "Sous-titre",
  description: "La phrase d'explication placée juste sous le titre.",
  variants: [
    {
      key: "control",
      label: "Un seul espace",
      description: "Énumère ce qui est réuni, en une phrase courte et vérifiable.",
      payload: {
        text: "Suivez vos loyers, vos locataires et vos documents dans un seul espace, sans chercher partout.",
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Appels à l'action                                                 */
/* ------------------------------------------------------------------ */

const HERO_CTA: SlotDef<"hero_cta"> = {
  key: "hero_cta",
  label: "Boutons du hero",
  description: "Libellés et destinations des deux appels à l'action principaux.",
  variants: [
    {
      key: "control",
      label: "Commencer gratuitement",
      description: "Formulation d'origine, neutre et rassurante.",
      payload: {
        primary: "Commencer gratuitement",
        href: "/inscription",
        secondary: "Découvrir Nireo",
        secondaryHref: "#decouvrir",
      },
    },
    {
      key: "instant",
      label: "Créer mon espace",
      description: "Insiste sur la mise en route immédiate.",
      payload: {
        primary: "Créer mon espace",
        href: "/inscription",
        secondary: "Découvrir Nireo",
        secondaryHref: "#decouvrir",
      },
    },
    {
      key: "no_card",
      label: "Sans carte bancaire",
      description: "Lève l'objection du paiement dès le bouton.",
      payload: {
        primary: "Essayer sans carte bancaire",
        href: "/inscription",
        secondary: "Voir les tarifs",
        secondaryHref: "#tarifs",
      },
    },
    {
      key: "resume",
      label: "Retour visiteur",
      description: "Pour un visiteur déjà venu : reprendre là où il s'était arrêté.",
      payload: {
        primary: "Reprendre mon inscription",
        href: "/inscription",
        secondary: "Me connecter",
        secondaryHref: "/connexion",
      },
    },
    {
      key: "member",
      label: "Utilisateur connecté",
      description: "Pour une session déjà connectée : retour direct à l'application.",
      payload: {
        primary: "Ouvrir mon tableau de bord",
        href: "/",
        secondary: "Voir les nouveautés",
        secondaryHref: "#fonctionnalites",
      },
    },
  ],
};

const FINAL_CTA: SlotDef<"final_cta"> = {
  key: "final_cta",
  label: "Appel à l'action final",
  description: "Le bloc de conversion en bas de page.",
  variants: [
    {
      key: "control",
      label: "Plus simple dès aujourd'hui",
      description: "Promesse de simplicité immédiate — référence de comparaison.",
      payload: {
        lead: "Votre gestion immobilière peut être",
        highlight: "plus simple dès aujourd’hui.",
        text: "Ajoutez votre premier logement gratuitement et retrouvez toutes vos informations dans un seul espace.",
        primary: "Commencer gratuitement",
      },
    },
    {
      key: "start_free",
      label: "Premier logement offert",
      description: "Rappelle l'offre gratuite, sans carte bancaire.",
      payload: {
        lead: "Votre premier logement,",
        highlight: "suivi gratuitement.",
        text: "Sans carte bancaire, sans engagement : ajoutez un logement et retrouvez toutes vos informations au même endroit.",
        primary: "Commencer gratuitement",
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Médias & preuves                                                  */
/* ------------------------------------------------------------------ */

const HERO_MEDIA: SlotDef<"hero_media"> = {
  key: "hero_media",
  label: "Média du hero",
  description:
    "Ce qui est montré à droite du titre. Toujours l'interface Nireo : aucune vidéo n'est servie sur la landing.",
  variants: [
    {
      key: "cockpit",
      label: "Tableau de bord",
      description: "Le tableau de bord Nireo, composé de panneaux réels (référence de comparaison).",
      payload: { kind: "cockpit" },
    },
    {
      key: "preview",
      label: "Aperçu d'interface",
      description: "Aperçu statique du tableau de bord, immédiatement lisible.",
      payload: { kind: "preview" },
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

const ORDER_DEFAULT: SectionKey[] = ["unify", "features", "proof", "pricing", "faq"];

const SECTION_ORDER: SlotDef<"section_order"> = {
  key: "section_order",
  label: "Ordre des sections",
  description: "L'enchaînement narratif de la page. Le hero reste en premier, le CTA final en dernier.",
  variants: [
    {
      key: "default",
      label: "Récit complet",
      description: "Problème → fonctionnalités → réassurance → tarifs → FAQ (ordre d'origine).",
      payload: { order: ORDER_DEFAULT },
    },
    {
      key: "features_first",
      label: "Fonctionnalités d'abord",
      description: "Montre le produit immédiatement après le hero — efficace sur trafic froid.",
      payload: { order: ["features", "unify", "proof", "pricing", "faq"] },
    },
    {
      key: "proof_early",
      label: "Réassurance d'abord",
      description: "Rassure très tôt — utile quand le trafic connaît peu la marque.",
      payload: { order: ["proof", "unify", "features", "pricing", "faq"] },
    },
    {
      key: "pricing_early",
      label: "Tarifs remontés",
      description: "Place les tarifs juste après les fonctionnalités — audience à intention d'achat.",
      payload: { order: ["features", "pricing", "unify", "proof", "faq"] },
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
