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

const HERO_HEADLINE: SlotDef<"hero_headline"> = {
  key: "hero_headline",
  label: "Titre principal",
  description: "Le premier message vu par le visiteur, en haut de la page.",
  variants: [
    {
      key: "control",
      label: "Centre de contrôle",
      description: "Promesse de centralisation — formulation d'origine, référence de comparaison.",
      payload: { lead: "Pilotez tout votre patrimoine", highlight: "depuis un seul endroit." },
    },
    {
      key: "clarity",
      label: "Sérénité",
      description: "Met en avant le bénéfice émotionnel : reprendre le contrôle.",
      payload: { lead: "Votre gestion locative,", highlight: "enfin sous contrôle." },
    },
    {
      key: "problem",
      label: "Problème",
      description: "Nomme la douleur du propriétaire (tableurs, oublis) avant la solution.",
      payload: { lead: "Fini les tableurs, les relances", highlight: "et les loyers oubliés." },
    },
    {
      key: "mobile",
      label: "Mobile",
      description: "Formulation courte et directe, pensée pour les arrivées réseaux sociaux.",
      payload: { lead: "Gérez vos locations", highlight: "depuis votre téléphone." },
    },
  ],
};

const HERO_SUBHEADLINE: SlotDef<"hero_subheadline"> = {
  key: "hero_subheadline",
  label: "Sous-titre",
  description: "La phrase d'explication placée juste sous le titre.",
  variants: [
    {
      key: "control",
      label: "Modules réunis",
      description: "Énumère les modules — formulation d'origine.",
      payload: {
        text: "Loyers, locataires, documents, dépenses et performances réunis dans un espace conçu pour les propriétaires exigeants.",
      },
    },
    {
      key: "benefit",
      label: "Bénéfice concret",
      description: "Insiste sur le temps gagné et la fin des oublis.",
      payload: {
        text: "Suivez vos loyers, vos locataires et vos documents sans tableur et sans oubli — tout est rangé, calculé et rappelé au bon moment.",
      },
    },
    {
      key: "automation",
      label: "Automatisation",
      description: "Met en avant ce que le produit fait tout seul.",
      payload: {
        text: "Les échéances se génèrent chaque mois, les documents se rangent par logement, les performances se calculent en continu.",
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
        secondaryHref: "#demo",
      },
    },
    {
      key: "instant",
      label: "Espace en 1 minute",
      description: "Insiste sur la rapidité de mise en route.",
      payload: {
        primary: "Créer mon espace en 1 minute",
        href: "/inscription",
        secondary: "Voir la démonstration",
        secondaryHref: "#demo",
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
      label: "Fichiers dispersés",
      description: "Rappelle le problème une dernière fois — formulation d'origine.",
      payload: {
        lead: "Votre patrimoine mérite mieux que",
        highlight: "des fichiers dispersés.",
        text: "Créez votre espace en une minute, ajoutez votre premier logement, et reprenez le contrôle.",
        primary: "Créer mon espace Nireo",
      },
    },
    {
      key: "start_free",
      label: "Premier logement offert",
      description: "Rappelle l'offre gratuite à vie pour un logement.",
      payload: {
        lead: "Votre premier logement,",
        highlight: "suivi gratuitement.",
        text: "Sans carte bancaire, sans engagement : ajoutez un logement et voyez ce que Nireo change dès aujourd'hui.",
        primary: "Commencer gratuitement",
      },
    },
    {
      key: "time",
      label: "Fin de la paperasse",
      description: "Promesse de tranquillité, ton plus direct.",
      payload: {
        lead: "Reprenez vos soirées.",
        highlight: "Nireo s'occupe du reste.",
        text: "Échéances, documents, relances et performances : votre gestion locative tourne sans vous y noyer.",
        primary: "Créer mon espace",
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
  description: "Ce qui est montré à droite du titre : composition produit, vidéo ou aperçu d'écran.",
  variants: [
    {
      key: "cockpit",
      label: "Cockpit animé",
      description: "Composition multi-panneaux animée (référence de comparaison).",
      payload: { kind: "cockpit" },
    },
    {
      key: "video",
      label: "Vidéo de présentation",
      description:
        "Lecteur de la vidéo publiée depuis /admin/entreprise. Indisponible tant qu'aucune vidéo n'est publiée.",
      payload: { kind: "video" },
      requires: "video",
    },
    {
      key: "preview",
      label: "Aperçu d'interface",
      description: "Capture d'écran fidèle de l'application, statique et immédiatement lisible.",
      payload: { kind: "preview" },
    },
  ],
};

const PROOF: SlotDef<"proof"> = {
  key: "proof",
  label: "Preuve & réassurance",
  description: "Le bloc qui rassure avant les tarifs.",
  variants: [
    {
      key: "guarantees",
      label: "Garanties produit",
      description: "Ce que Nireo garantit réellement (isolation des données, hébergement, sauvegardes).",
      payload: { kind: "guarantees" },
    },
    {
      key: "figures",
      label: "Bénéfices chiffrés",
      description: "Les chiffres vérifiables du produit — jamais de statistiques clients inventées.",
      payload: { kind: "figures" },
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

const ORDER_DEFAULT: SectionKey[] = [
  "trust",
  "before_after",
  "demo",
  "features",
  "day",
  "proof",
  "pricing",
  "company",
  "faq",
];

const SECTION_ORDER: SlotDef<"section_order"> = {
  key: "section_order",
  label: "Ordre des sections",
  description: "L'enchaînement narratif de la page. Le hero reste en premier, le CTA final en dernier.",
  variants: [
    {
      key: "default",
      label: "Récit complet",
      description: "Problème → démonstration → fonctionnalités → preuve → tarifs (ordre d'origine).",
      payload: { order: ORDER_DEFAULT },
    },
    {
      key: "demo_first",
      label: "Démonstration d'abord",
      description: "Montre le produit immédiatement après le hero — efficace sur trafic froid.",
      payload: {
        order: ["trust", "demo", "before_after", "features", "proof", "day", "pricing", "company", "faq"],
      },
    },
    {
      key: "proof_early",
      label: "Réassurance d'abord",
      description: "Rassure très tôt — utile quand le trafic connaît peu la marque.",
      payload: {
        order: ["trust", "proof", "demo", "before_after", "features", "day", "pricing", "company", "faq"],
      },
    },
    {
      key: "pricing_early",
      label: "Tarifs remontés",
      description: "Place les tarifs juste après la démonstration — pour une audience à intention d'achat.",
      payload: {
        order: ["trust", "demo", "pricing", "before_after", "features", "proof", "day", "company", "faq"],
      },
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
