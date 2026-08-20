import type { AppData, DocumentCategory, PropertyDocument } from "@/lib/types";

/**
 * Organisation de l'espace documentaire.
 *
 * POURQUOI DES GROUPES, ET PAS SEULEMENT DES CATÉGORIES
 * -----------------------------------------------------
 * La base connaît sept catégories, héritées de l'usage : `bail`,
 * `etat_des_lieux`, `assurance`, `diagnostics`, `factures`, `garanties`,
 * `autres`. Sept sections, c'est trop pour retrouver quelque chose d'un coup
 * d'œil : l'assurance, les diagnostics et les garanties sont des pièces
 * qu'on consulte une fois par an, alors que les baux et les quittances sont
 * consultés tous les mois.
 *
 * On garde donc les catégories en base — rien à migrer, aucun document à
 * reclasser — et on les regroupe à l'AFFICHAGE en cinq sections utiles. Un
 * document ne change jamais de catégorie tout seul : il change seulement de
 * section d'affichage, et l'utilisateur peut toujours corriger sa catégorie.
 *
 * LA CATÉGORIE « loyers »
 * -----------------------
 * C'est la seule nouveauté : les quittances et reçus n'avaient nulle part où
 * aller (ils finissaient dans « autres » ou « factures »). Elle exige
 * d'élargir la contrainte CHECK de la table `documents` — voir la migration
 * `20260820100000_document_category_loyers.sql`. Tant que cette migration
 * n'est pas appliquée, la base REFUSE la valeur : le store retombe alors sur
 * `autres` plutôt que d'échouer (cf. `addDocument`).
 */

export type DocumentGroupId =
  | "baux"
  | "loyers"
  | "etats_des_lieux"
  | "factures"
  | "autres";

export interface DocumentGroup {
  id: DocumentGroupId;
  label: string;
  /** Phrase courte affichée quand la section est vide. */
  emptyHint: string;
  /** Catégories de la base rassemblées sous cette section. */
  categories: readonly DocumentCategory[];
}

export const DOCUMENT_GROUPS: readonly DocumentGroup[] = [
  {
    id: "baux",
    label: "Baux",
    emptyHint: "Baux signés, avenants et renouvellements.",
    categories: ["bail"],
  },
  {
    id: "loyers",
    label: "Loyers",
    emptyHint: "Quittances et reçus de loyer, mois par mois.",
    categories: ["loyers"],
  },
  {
    id: "etats_des_lieux",
    label: "États des lieux",
    emptyHint: "Entrée, sortie, et les pièces qui les accompagnent.",
    categories: ["etat_des_lieux"],
  },
  {
    id: "factures",
    label: "Factures & dépenses",
    emptyHint: "Factures de travaux, réparations et charges.",
    categories: ["factures"],
  },
  {
    id: "autres",
    label: "Autres documents",
    // Assurance, diagnostics et garanties gardent leur catégorie propre —
    // c'est elle qui porte la date d'expiration et les rappels — mais se
    // rangent ici : ce sont des pièces annuelles, pas du quotidien.
    emptyHint: "Assurances, diagnostics, garanties et tout le reste.",
    categories: ["assurance", "diagnostics", "garanties", "autres"],
  },
];

/** Section d'affichage d'une catégorie. `autres` sert de refuge. */
export function groupOfCategory(category: DocumentCategory): DocumentGroupId {
  const group = DOCUMENT_GROUPS.find((g) => g.categories.includes(category));
  return group ? group.id : "autres";
}

/* ------------------------------------------------------------------ */
/*  Classement automatique                                             */
/* ------------------------------------------------------------------ */

/**
 * Indices de catégorie, lus dans le nom du fichier.
 *
 * L'ordre compte : le premier motif trouvé gagne. « bail_quittance.pdf » est
 * donc un bail, ce qui est le cas le plus probable — une quittance ne se
 * nomme pas d'après le bail.
 *
 * Les motifs sont volontairement peu nombreux et sans ambiguïté. Deviner
 * trop finement produirait des classements faux, plus pénibles à corriger
 * qu'une absence de classement : dans le doute, `autres` et l'utilisateur
 * tranche.
 */
const INDICES: readonly { motif: RegExp; category: DocumentCategory }[] = [
  { motif: /\b(bail|baux|location)\b|avenant/i, category: "bail" },
  { motif: /quittance|recu[_\s-]*(de[_\s-]*)?loyer|re[çc]u[_\s-]*loyer|\bloyer/i, category: "loyers" },
  { motif: /etat[_\s-]*des[_\s-]*lieux|état[_\s-]*des[_\s-]*lieux|\bedl\b/i, category: "etat_des_lieux" },
  { motif: /facture|devis|travaux|reparation|réparation|charges?/i, category: "factures" },
  { motif: /assurance|habitation|\bmrh\b|sinistre/i, category: "assurance" },
  { motif: /diagnostic|\bdpe\b|amiante|plomb|electricit|électricit|\berp\b/i, category: "diagnostics" },
  { motif: /garantie|caution|\bgli\b/i, category: "garanties" },
];

/**
 * Catégorie déduite d'un nom de fichier, ou `null` si rien n'est sûr.
 *
 * `null` et non `autres` : l'appelant doit pouvoir distinguer « je propose
 * autres » de « je n'ai rien trouvé », et ne pas écraser un choix déjà fait
 * par l'utilisateur.
 */
export function guessCategory(fileName: string): DocumentCategory | null {
  const nom = fileName.normalize("NFC");
  for (const { motif, category } of INDICES) {
    if (motif.test(nom)) return category;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Locataire associé                                                  */
/* ------------------------------------------------------------------ */

/**
 * Locataire rattaché à un document, déduit de son LOGEMENT.
 *
 * La table `documents` n'a pas de `tenant_id` et n'en aura pas ici : ajouter
 * une colonne pour un affichage se paierait d'une migration, d'une règle RLS
 * de plus et d'un risque d'incohérence avec le bail. Le lien réel passe déjà
 * par le logement.
 *
 * Renvoie `null` dès qu'il y a plusieurs locataires actifs (colocation) : un
 * seul nom serait alors trompeur.
 */
export function tenantOfDocument(
  data: AppData,
  document: PropertyDocument
): string | null {
  // `exitDate === null` = bail en cours (cf. types.ts) : un locataire parti
  // n'a pas à s'afficher sous un document du logement qu'il a quitté.
  const locataires = data.tenants.filter(
    (t) => t.propertyId === document.propertyId && t.exitDate === null
  );
  if (locataires.length !== 1) return null;
  const t = locataires[0];
  return `${t.firstName} ${t.lastName}`.trim() || null;
}

/** Regroupe des documents par section, dans l'ordre de `DOCUMENT_GROUPS`. */
export function groupDocuments(
  documents: readonly PropertyDocument[]
): { group: DocumentGroup; items: PropertyDocument[] }[] {
  return DOCUMENT_GROUPS.map((group) => ({
    group,
    items: documents
      .filter((d) => group.categories.includes(d.category))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  }));
}
