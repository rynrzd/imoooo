import type {
  ActivityType,
  DocumentCategory,
  ExpenseCategory,
  PhotoCategory,
  PropertyStatus,
  RentStatus,
  WorkStatus,
} from "./types";

/** Libellés français centralisés pour toutes les énumérations du domaine. */

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  loue: "Loué",
  vacant: "Vacant",
  travaux: "En travaux",
};

export const RENT_STATUS_LABELS: Record<RentStatus, string> = {
  paye: "Payé",
  attente: "En attente",
  retard: "En retard",
  partiel: "Partiel",
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  bail: "Bail",
  etat_des_lieux: "État des lieux",
  assurance: "Assurance",
  diagnostics: "Diagnostics",
  factures: "Factures",
  garanties: "Garanties",
  autres: "Autres documents",
};

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  avant_location: "Avant location",
  apres_travaux: "Après travaux",
  entree: "Entrée",
  sortie: "Sortie",
  dommages: "Dommages",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travaux: "Travaux",
  assurance: "Assurance",
  taxe_fonciere: "Taxe foncière",
  copropriete: "Copropriété",
  autres: "Autres",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  paiement: "Paiement",
  retard: "Retard",
  travaux: "Travaux",
  document: "Document",
  locataire: "Locataire",
  logement: "Logement",
  photo: "Photo",
  depense: "Dépense",
};

/** Options prêtes pour un <Select> à partir d'un dictionnaire de libellés. */
export function toOptions<T extends string>(
  labels: Record<T, string>
): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}
