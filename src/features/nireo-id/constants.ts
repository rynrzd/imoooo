/**
 * Nireo ID — constantes partagées (client et serveur).
 *
 * Source unique des statuts, types et libellés : aucune chaîne de
 * caractères métier n'est dupliquée dans les composants ou les requêtes.
 * Les valeurs correspondent EXACTEMENT aux contraintes CHECK de la
 * migration `20260808090000_nireo_id.sql`.
 */

/* ------------------------------------------------------------------ */
/*  Marque et périmètre                                                */
/* ------------------------------------------------------------------ */

export const NID_PRODUCT_NAME = "Nireo ID";

/** Catégorie unique du MVP. Le modèle de données reste extensible. */
export const NID_CATEGORY = "smartphone" as const;

/** Racine des routes du produit. */
export const NID_BASE_PATH = "/id";
export const NID_APP_PATH = "/id/app";

/* ------------------------------------------------------------------ */
/*  Niveaux de confiance                                               */
/* ------------------------------------------------------------------ */

/**
 * Signification STRICTE des niveaux. Les libellés affichés ne promettent
 * jamais plus que ce que le produit vérifie réellement : le terme
 * « vérifié par Nireo » est interdit tant qu'aucun protocole de contrôle
 * Nireo n'existe.
 */
export const TRUST_LEVELS = {
  0: {
    value: 0,
    label: "Déclaré par le propriétaire",
    short: "Déclaré",
    meaning:
      "Information saisie par l'utilisateur, sans pièce justificative contrôlée.",
    tone: "neutral",
  },
  1: {
    value: 1,
    label: "Document fourni",
    short: "Document",
    meaning:
      "Un document a été ajouté. Nireo ne certifie pas automatiquement son authenticité.",
    tone: "info",
  },
  2: {
    value: 2,
    label: "Validé par un professionnel",
    short: "Professionnel",
    meaning:
      "Événement créé par un compte professionnel approuvé par Nireo, autorisé par le propriétaire.",
    tone: "success",
  },
  3: {
    value: 3,
    label: "Contesté",
    short: "Contesté",
    meaning:
      "Une anomalie a été signalée : cette information ne doit pas être considérée comme fiable.",
    tone: "warning",
  },
  4: {
    value: 4,
    label: "Révoqué",
    short: "Révoqué",
    meaning:
      "La validation a été retirée par le professionnel concerné ou par un administrateur, avec motif.",
    tone: "danger",
  },
} as const;

export type TrustLevel = 0 | 1 | 2 | 3 | 4;

export const TRUST_LEVEL_VALUES: TrustLevel[] = [0, 1, 2, 3, 4];

export function trustLevelInfo(level: number) {
  const key = (TRUST_LEVEL_VALUES.includes(level as TrustLevel) ? level : 0) as TrustLevel;
  return TRUST_LEVELS[key];
}

/* ------------------------------------------------------------------ */
/*  Événements                                                         */
/* ------------------------------------------------------------------ */

export const EVENT_TYPES = [
  "achat",
  "controle_etat",
  "reparation",
  "remplacement_piece",
  "incident",
  "garantie",
  "transfert",
  "autre",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  achat: "Achat",
  controle_etat: "Contrôle d'état",
  reparation: "Réparation",
  remplacement_piece: "Remplacement de pièce",
  incident: "Incident",
  garantie: "Ajout de garantie",
  transfert: "Transfert de propriété",
  autre: "Autre",
};

/** Types qu'un propriétaire peut déclarer lui-même (le transfert est automatique). */
export const OWNER_EVENT_TYPES: EventType[] = [
  "controle_etat",
  "reparation",
  "remplacement_piece",
  "incident",
  "garantie",
  "autre",
];

/** Types qu'un professionnel approuvé peut enregistrer. */
export const PRO_EVENT_TYPES: EventType[] = [
  "reparation",
  "remplacement_piece",
  "controle_etat",
];

export const AUTHOR_ROLES = ["proprietaire", "professionnel", "systeme"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

/* ------------------------------------------------------------------ */
/*  Passeport                                                          */
/* ------------------------------------------------------------------ */

export const ASSET_STATUSES = ["active", "transfer_pending", "archived", "disputed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: "Actif",
  transfer_pending: "Transfert en cours",
  archived: "Archivé",
  disputed: "Contesté",
};

export const PURCHASE_CONDITIONS = ["neuf", "reconditionne", "occasion", "inconnu"] as const;
export type PurchaseCondition = (typeof PURCHASE_CONDITIONS)[number];

export const PURCHASE_CONDITION_LABELS: Record<PurchaseCondition, string> = {
  neuf: "Neuf",
  reconditionne: "Reconditionné",
  occasion: "Occasion",
  inconnu: "Inconnu",
};

/** Points du constat d'état déclaré (étape 4 de l'assistant). */
export const CONDITION_POINTS = [
  { key: "ecran", label: "Écran" },
  { key: "chassis", label: "Coque / châssis" },
  { key: "cameras", label: "Caméras" },
  { key: "boutons", label: "Boutons" },
  { key: "charge", label: "Charge" },
] as const;

export type ConditionPointKey = (typeof CONDITION_POINTS)[number]["key"];

export const CONDITION_GRADES = ["parfait", "bon", "usure", "defaut", "inconnu"] as const;
export type ConditionGrade = (typeof CONDITION_GRADES)[number];

export const CONDITION_GRADE_LABELS: Record<ConditionGrade, string> = {
  parfait: "Parfait",
  bon: "Bon",
  usure: "Usure visible",
  defaut: "Défaut",
  inconnu: "Non évalué",
};

/* ------------------------------------------------------------------ */
/*  Documents et photos                                                */
/* ------------------------------------------------------------------ */

export const DOCUMENT_KINDS = ["facture", "garantie", "rapport", "autre"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  facture: "Preuve d'achat / facture",
  garantie: "Garantie",
  rapport: "Compte rendu d'intervention",
  autre: "Autre document",
};

export const TRANSFER_POLICIES = ["prive", "transferable", "partage_temporaire"] as const;
export type TransferPolicy = (typeof TRANSFER_POLICIES)[number];

export const TRANSFER_POLICY_LABELS: Record<TransferPolicy, string> = {
  prive: "Ne pas transférer (reste privé)",
  transferable: "Transférer au nouveau propriétaire",
  partage_temporaire: "Partager 30 jours après le transfert",
};

/** Bucket privé Nireo ID (aucune URL publique persistante). */
export const NID_BUCKET = "nireo-id-private";

/** Limites d'envoi — vérifiées côté serveur ET au niveau du bucket. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 Mo
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 Mo
export const MAX_CONDITION_PHOTOS = 6;

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const ALLOWED_DOCUMENT_MIME = [...ALLOWED_IMAGE_MIME, "application/pdf"] as const;

/* ------------------------------------------------------------------ */
/*  Partage privé                                                      */
/* ------------------------------------------------------------------ */

export const SHARE_SECTIONS = ["caracteristiques", "historique", "photos", "documents"] as const;
export type ShareSection = (typeof SHARE_SECTIONS)[number];

export const SHARE_SECTION_LABELS: Record<ShareSection, string> = {
  caracteristiques: "Caractéristiques",
  historique: "Historique",
  photos: "Photos",
  documents: "Documents sélectionnés",
};

export const SHARE_DURATIONS = [
  { value: 24, label: "24 heures" },
  { value: 24 * 7, label: "7 jours" },
  { value: 24 * 30, label: "30 jours" },
] as const;

export type ShareDurationHours = (typeof SHARE_DURATIONS)[number]["value"];

/** Durée de validité d'une URL signée (lecture d'un fichier privé). */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

/* ------------------------------------------------------------------ */
/*  Transferts                                                         */
/* ------------------------------------------------------------------ */

export const TRANSFER_STATUSES = ["en_attente", "accepte", "refuse", "annule", "expire"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  en_attente: "En attente",
  accepte: "Accepté",
  refuse: "Refusé",
  annule: "Annulé",
  expire: "Expiré",
};

/** Durée de validité d'une demande de transfert. */
export const TRANSFER_EXPIRY_DAYS = 7;

/* ------------------------------------------------------------------ */
/*  Professionnels                                                     */
/* ------------------------------------------------------------------ */

export const PRO_STATUSES = ["brouillon", "en_attente", "approuve", "refuse", "suspendu"] as const;
export type ProStatus = (typeof PRO_STATUSES)[number];

export const PRO_STATUS_LABELS: Record<ProStatus, string> = {
  brouillon: "Brouillon",
  en_attente: "En attente de validation",
  approuve: "Approuvé",
  refuse: "Refusé",
  suspendu: "Suspendu",
};

export const PRO_ACTIVITIES = ["reparation", "reconditionnement", "diagnostic"] as const;
export type ProActivity = (typeof PRO_ACTIVITIES)[number];

export const PRO_ACTIVITY_LABELS: Record<ProActivity, string> = {
  reparation: "Réparation",
  reconditionnement: "Reconditionnement",
  diagnostic: "Diagnostic",
};

export const PRO_ACCESS_STATUSES = [
  "en_attente",
  "accorde",
  "refuse",
  "revoque",
  "expire",
] as const;
export type ProAccessStatus = (typeof PRO_ACCESS_STATUSES)[number];

export const PRO_ACCESS_STATUS_LABELS: Record<ProAccessStatus, string> = {
  en_attente: "Demande en attente",
  accorde: "Accès accordé",
  refuse: "Refusé",
  revoque: "Révoqué",
  expire: "Expiré",
};

export const PRO_ACCESS_SOURCES = ["lien_partage", "invitation", "demande_identifiant"] as const;
export type ProAccessSource = (typeof PRO_ACCESS_SOURCES)[number];

/** Durée d'un accès professionnel accordé sur un passeport. */
export const PRO_ACCESS_DAYS = 30;

/* ------------------------------------------------------------------ */
/*  Signalements                                                       */
/* ------------------------------------------------------------------ */

export const DISPUTE_REASONS = [
  "information_inexacte",
  "document_suspect",
  "usurpation",
  "autre",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  information_inexacte: "Information inexacte",
  document_suspect: "Document suspect",
  usurpation: "Usurpation de propriété",
  autre: "Autre motif",
};

export const DISPUTE_STATUSES = ["ouvert", "en_examen", "resolu", "rejete"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  ouvert: "Ouvert",
  en_examen: "En examen",
  resolu: "Résolu",
  rejete: "Rejeté",
};

/* ------------------------------------------------------------------ */
/*  Identifiant public                                                 */
/* ------------------------------------------------------------------ */

/** Format : NIR-PH-XXXX-XXXX (alphabet sans caractères ambigus). */
export const PUBLIC_ID_PATTERN = /^NIR-PH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

export function isPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value.trim().toUpperCase());
}
