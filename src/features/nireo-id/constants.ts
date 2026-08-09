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
/*  Téléphone                                                          */
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

/** Durée d'un accès professionnel accordé sur un téléphone. */
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

/* ================================================================== */
/*  V2 — espaces, affectations, bilans, réparations, provenance        */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  Promesse produit                                                   */
/* ------------------------------------------------------------------ */

export const NID_TAGLINE = "Le suivi simple de votre téléphone.";
export const NID_SUBLINE = "Facture, état et réparations au même endroit.";

/* ------------------------------------------------------------------ */
/*  Espaces                                                            */
/* ------------------------------------------------------------------ */

export const WORKSPACE_KINDS = ["personnel", "entreprise", "atelier"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_KIND_LABELS: Record<WorkspaceKind, string> = {
  personnel: "Espace personnel",
  entreprise: "Entreprise",
  atelier: "Atelier de réparation",
};

export const WORKSPACE_ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Propriétaire de l'espace",
  admin: "Administration complète",
  manager: "Gestion du parc",
  member: "Accès à son téléphone",
  viewer: "Lecture seule",
};

export const WORKSPACE_ROLE_HINTS: Record<WorkspaceRole, string> = {
  owner: "Tous les droits, y compris l'abonnement et la suppression de l'espace.",
  admin: "Gère l'entreprise, les collaborateurs et le parc.",
  manager: "Gère le parc, les affectations, les bilans et les réparations.",
  member: "Voit uniquement le téléphone qui lui est affecté.",
  viewer: "Consulte le parc sans rien modifier.",
};

/** Rôles autorisés à gérer le parc (vérifié aussi par la RLS). */
export const MANAGING_ROLES: WorkspaceRole[] = ["owner", "admin", "manager"];
/** Rôles autorisés à voir l'ensemble du parc. */
export const FLEET_READ_ROLES: WorkspaceRole[] = ["owner", "admin", "manager", "viewer"];

/** Rôles proposables lors d'une invitation (le rôle owner ne s'invite pas). */
export const INVITABLE_ROLES: WorkspaceRole[] = ["admin", "manager", "member", "viewer"];

/* ------------------------------------------------------------------ */
/*  États du parc                                                      */
/* ------------------------------------------------------------------ */

export const FLEET_STATUSES = [
  "en_stock",
  "affecte",
  "prete",
  "en_reparation",
  "retourne",
  "pret_a_vendre",
  "vendu",
  "recycle",
  "perdu",
  "declare_vole",
] as const;

export type FleetStatus = (typeof FLEET_STATUSES)[number];

export const FLEET_STATUS_LABELS: Record<FleetStatus, string> = {
  en_stock: "En stock",
  affecte: "Affecté",
  prete: "Prêté",
  en_reparation: "En réparation",
  retourne: "Retourné",
  pret_a_vendre: "Prêt à vendre",
  vendu: "Vendu ou transféré",
  recycle: "Recyclé",
  perdu: "Perdu",
  declare_vole: "Déclaré volé",
};

/**
 * « Déclaré volé » est une déclaration de l'utilisateur ou de l'entreprise.
 * Nireo n'interroge AUCUNE base officielle : ce libellé ne doit jamais être
 * présenté comme une vérification.
 */
export const FLEET_STATUS_NOTE: Partial<Record<FleetStatus, string>> = {
  declare_vole:
    "Déclaré par vous. Nireo n'interroge aucun fichier officiel des téléphones volés.",
};

/* ------------------------------------------------------------------ */
/*  État de santé affiché (jamais de score sur 100)                    */
/* ------------------------------------------------------------------ */

export const HEALTH_STATES = [
  "bon_etat",
  "a_surveiller",
  "probleme_declare",
  "en_reparation",
] as const;

export type HealthState = (typeof HEALTH_STATES)[number];

export const HEALTH_STATE_LABELS: Record<HealthState, string> = {
  bon_etat: "Bon état",
  a_surveiller: "À surveiller",
  probleme_declare: "Problème déclaré",
  en_reparation: "En réparation",
};

export const HEALTH_STATE_TONES: Record<HealthState, "success" | "warning" | "danger" | "info"> = {
  bon_etat: "success",
  a_surveiller: "warning",
  probleme_declare: "danger",
  en_reparation: "info",
};

/* ------------------------------------------------------------------ */
/*  Provenance des informations                                        */
/* ------------------------------------------------------------------ */

export const SOURCE_TYPES = [
  "declare_proprietaire",
  "declare_detenteur",
  "document_fourni",
  "atteste_reparateur",
  "importe",
  "mesure_diagnostic",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Libellés STRICTS. « Vérifié / certifié / authentifié par Nireo » est
 * interdit : Nireo n'effectue aucun contrôle automatique.
 */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  declare_proprietaire: "Déclaré par le propriétaire",
  declare_detenteur: "Déclaré par le détenteur",
  document_fourni: "Document fourni",
  atteste_reparateur: "Attesté par un réparateur",
  importe: "Importé depuis un système",
  mesure_diagnostic: "Mesuré par un diagnostic",
};

export const SOURCE_TYPE_MEANINGS: Record<SourceType, string> = {
  declare_proprietaire: "Information saisie par le propriétaire du téléphone.",
  declare_detenteur: "Information saisie par la personne qui utilise le téléphone.",
  document_fourni: "Un document a été joint. Son authenticité n'est pas contrôlée automatiquement.",
  atteste_reparateur:
    "Intervention enregistrée par un atelier dont l'identité professionnelle est approuvée par Nireo.",
  importe: "Information reprise d'un fichier ou d'un système externe.",
  mesure_diagnostic: "Valeur issue d'un diagnostic réellement exécuté.",
};

/* ------------------------------------------------------------------ */
/*  Bilans                                                             */
/* ------------------------------------------------------------------ */

export const CHECK_ANSWERS = [
  "tout_fonctionne",
  "probleme",
  "repare",
  "plus_detenu",
] as const;

export type CheckAnswer = (typeof CHECK_ANSWERS)[number];

export const CHECK_ANSWER_LABELS: Record<CheckAnswer, string> = {
  tout_fonctionne: "Oui, tout va bien",
  probleme: "J'ai remarqué un problème",
  repare: "Il a été réparé",
  plus_detenu: "Je ne possède plus ce téléphone",
};

export const CHECK_ANSWER_SHORT: Record<CheckAnswer, string> = {
  tout_fonctionne: "Tout fonctionne",
  probleme: "Problème constaté",
  repare: "Téléphone réparé",
  plus_detenu: "Plus détenu",
};

/** Détails demandés uniquement lorsqu'ils sont utiles (réponse « problème »). */
export const CHECK_DETAIL_POINTS = [
  { key: "ecran", label: "Écran" },
  { key: "chassis", label: "Châssis ou coque" },
  { key: "autonomie", label: "Autonomie ressentie" },
  { key: "camera", label: "Caméra" },
  { key: "son", label: "Son et microphone" },
  { key: "charge", label: "Charge" },
  { key: "boutons", label: "Boutons et tactile" },
  { key: "chute_eau", label: "Chute ou contact avec l'eau" },
] as const;

export type CheckDetailKey = (typeof CHECK_DETAIL_POINTS)[number]["key"];

export const CHECK_SCOPES = ["mini", "complet"] as const;
export type CheckScope = (typeof CHECK_SCOPES)[number];

export const CHECK_SCOPE_LABELS: Record<CheckScope, string> = {
  mini: "Bilan rapide",
  complet: "Bilan complet",
};

export const CHECK_EMAIL_STATUSES = ["en_attente", "envoye", "echec", "manuel"] as const;
export type CheckEmailStatus = (typeof CHECK_EMAIL_STATUSES)[number];

export const CHECK_EMAIL_STATUS_LABELS: Record<CheckEmailStatus, string> = {
  en_attente: "À envoyer",
  envoye: "E-mail envoyé",
  echec: "Envoi impossible",
  manuel: "Lien à transmettre",
};

/** Fréquences proposées (modifiables par l'utilisateur). */
export const CHECK_FREQUENCIES = [
  { value: 1, label: "Tous les mois" },
  { value: 3, label: "Tous les 3 mois" },
  { value: 6, label: "Tous les 6 mois" },
  { value: 12, label: "Une fois par an" },
] as const;

/** Durée de validité d'un lien de bilan. */
export const CHECK_REQUEST_DAYS = 45;

/* ------------------------------------------------------------------ */
/*  Réparations                                                        */
/* ------------------------------------------------------------------ */

export const REPAIR_STATUSES = [
  "a_diagnostiquer",
  "en_cours",
  "en_attente_validation",
  "termine",
  "annule",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  a_diagnostiquer: "À diagnostiquer",
  en_cours: "En cours",
  en_attente_validation: "En attente de validation",
  termine: "Terminée",
  annule: "Annulée",
};

export const PARTS_TYPES = ["origine", "compatible", "reconditionne", "inconnu"] as const;
export type PartsType = (typeof PARTS_TYPES)[number];

export const PARTS_TYPE_LABELS: Record<PartsType, string> = {
  origine: "Pièces d'origine",
  compatible: "Pièces compatibles",
  reconditionne: "Pièces reconditionnées",
  inconnu: "Type non précisé",
};

/** Durée de validité du lien remis à l'atelier. */
export const REPAIR_LINK_DAYS = 30;

/* ------------------------------------------------------------------ */
/*  Invitations                                                        */
/* ------------------------------------------------------------------ */

export const INVITE_DAYS = 14;

/* ------------------------------------------------------------------ */
/*  Ajout d'un téléphone                                               */
/* ------------------------------------------------------------------ */

export const ADD_METHODS = ["scan", "facture", "etiquette", "manuel"] as const;
export type AddMethod = (typeof ADD_METHODS)[number];

export const ADD_METHOD_LABELS: Record<AddMethod, string> = {
  scan: "Scanner la boîte",
  facture: "Ajouter une facture",
  etiquette: "Scanner l'étiquette européenne",
  manuel: "Saisir manuellement",
};

export const ADD_METHOD_HINTS: Record<AddMethod, string> = {
  scan: "Lisez le code-barres ou le QR code de la boîte avec la caméra.",
  facture: "Ajoutez la facture, puis complétez les informations à côté du document.",
  etiquette: "Lisez le QR code de l'étiquette énergie ; le lien officiel est conservé.",
  manuel: "Saisissez la marque, le modèle et les informations que vous avez.",
};

/** Domaines officiels de l'étiquette énergétique européenne (EPREL). */
export const EPREL_HOSTS = ["eprel.ec.europa.eu", "ec.europa.eu"] as const;

/* ------------------------------------------------------------------ */
/*  Import CSV (entreprise)                                            */
/* ------------------------------------------------------------------ */

export const CSV_COLUMNS = [
  "marque",
  "modele",
  "capacite",
  "couleur",
  "numero_serie",
  "imei",
  "reference_interne",
  "date_achat",
  "prix_euros",
  "type_achat",
  "fin_garantie",
  "detenteur_nom",
  "detenteur_email",
] as const;

export const CSV_TEMPLATE_HEADER = CSV_COLUMNS.join(";");

export const MAX_CSV_ROWS = 500;
