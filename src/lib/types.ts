/**
 * Modèle de données central de Noviqo.
 * Toutes les entités sont normalisées et reliées par identifiants,
 * pour une migration simple vers une base de données (Supabase) plus tard.
 */

export type PropertyStatus = "loue" | "vacant" | "travaux";

export type PropertyType = "Studio" | "T1" | "T2" | "T3" | "T4" | "T5" | "Maison";

export interface Property {
  id: string;
  /** Nom court affiché dans l'interface (ex. "T2 Part-Dieu"). */
  name: string;
  address: string;
  postalCode: string;
  city: string;
  type: PropertyType;
  /** Surface habitable en m². */
  surface: number;
  rooms: number;
  photo: string;
  purchasePrice: number;
  /** Date ISO (yyyy-mm-dd). */
  purchaseDate: string;
  /** Loyer mensuel hors charges. */
  rent: number;
  /** Provision sur charges mensuelle. */
  charges: number;
  status: PropertyStatus;
  /** Locataire actuellement en place, s'il y en a un. */
  currentTenantId: string | null;
}

export interface Tenant {
  id: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Date ISO d'entrée dans les lieux. */
  entryDate: string;
  /** Date ISO de sortie — null si le bail est en cours. */
  exitDate: string | null;
  rent: number;
  charges: number;
  deposit: number;
}

export type RentStatus = "paye" | "attente" | "retard" | "partiel";

export interface RentPayment {
  id: string;
  propertyId: string;
  tenantId: string;
  /** Mois concerné, au format yyyy-mm. */
  month: string;
  /** Montant attendu (loyer + charges). */
  expected: number;
  /** Montant effectivement encaissé. */
  received: number;
  /** Date ISO d'encaissement — null tant que rien n'est reçu. */
  paidAt: string | null;
  status: RentStatus;
  comment: string;
}

export type DocumentCategory =
  | "bail"
  | "etat_des_lieux"
  | "assurance"
  | "diagnostics"
  | "factures"
  | "garanties"
  | "autres";

export interface PropertyDocument {
  id: string;
  propertyId: string;
  name: string;
  category: DocumentCategory;
  /** Date ISO d'ajout. */
  addedAt: string;
  /** Taille lisible (ex. "1,2 Mo"). */
  size: string;
  fileType: "pdf" | "jpg" | "png" | "docx";
  /** Chemin du fichier dans Supabase Storage — null si pas de fichier. */
  filePath: string | null;
  /** Date ISO d'expiration (assurance, diagnostics…) — null si sans objet. */
  expiresAt?: string | null;
}

export type PhotoCategory =
  | "avant_location"
  | "apres_travaux"
  | "entree"
  | "sortie"
  | "dommages";

export interface PropertyPhoto {
  id: string;
  propertyId: string;
  url: string;
  caption: string;
  category: PhotoCategory;
  /** Date ISO de prise de vue. */
  takenAt: string;
  /** Chemin dans Supabase Storage — null si l'image est une URL externe. */
  storagePath: string | null;
}

export type WorkStatus = "planifie" | "en_cours" | "termine";

export interface Work {
  id: string;
  propertyId: string;
  title: string;
  company: string;
  /** Budget prévu. */
  amount: number;
  /** Date ISO de début / réalisation. */
  date: string;
  status: WorkStatus;
  /** Document facture associé, s'il existe. */
  invoiceDocumentId: string | null;
  /** Photos associées au chantier. */
  photoIds: string[];
  /** Coût réel constaté — null tant que le chantier n'est pas facturé. */
  actualCost?: number | null;
  /** Avancement manuel 0-100 — null : déduit du statut. */
  progress?: number | null;
  /** Date ISO de fin prévue. */
  endDate?: string | null;
}

export type ExpenseCategory =
  | "travaux"
  | "assurance"
  | "taxe_fonciere"
  | "copropriete"
  | "autres";

export interface Expense {
  id: string;
  propertyId: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
  /** Date ISO de la dépense. */
  date: string;
  /** Fournisseur / prestataire. */
  supplier?: string;
  /** Justificatif dans le bucket expense-receipts — null si aucun. */
  receiptPath?: string | null;
  /** Dépense liée à un chantier (créée automatiquement). */
  maintenanceRecordId?: string | null;
}

export type ActivityType =
  | "paiement"
  | "retard"
  | "travaux"
  | "document"
  | "locataire"
  | "logement"
  | "photo"
  | "depense";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  /** Date ISO de l'événement. */
  date: string;
  propertyId: string | null;
}

/** État global de l'application (remplacé plus tard par la base de données). */
export interface AppData {
  properties: Property[];
  tenants: Tenant[];
  rentPayments: RentPayment[];
  documents: PropertyDocument[];
  photos: PropertyPhoto[];
  works: Work[];
  expenses: Expense[];
  activity: ActivityItem[];
}
