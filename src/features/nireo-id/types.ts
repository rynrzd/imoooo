/**
 * Nireo ID — types des lignes de base de données et vues applicatives.
 * Miroir exact des tables `nid_*` (migration 20260808090000).
 */

import type {
  AssetStatus,
  AuthorRole,
  CheckAnswer,
  CheckEmailStatus,
  CheckScope,
  ConditionGrade,
  ConditionPointKey,
  DisputeReason,
  DisputeStatus,
  DocumentKind,
  EventType,
  FleetStatus,
  HealthState,
  PartsType,
  ProAccessSource,
  ProAccessStatus,
  ProActivity,
  ProStatus,
  PurchaseCondition,
  RepairStatus,
  ShareSection,
  SourceType,
  TransferPolicy,
  TransferStatus,
  TrustLevel,
  WorkspaceKind,
  WorkspaceRole,
} from "./constants";

/** Constat d'état déclaré (étape 4 de l'assistant). */
export type DeclaredCondition = Partial<Record<ConditionPointKey, ConditionGrade>> & {
  battery_health?: number | null;
  comment?: string;
};

export interface AssetRow {
  id: string;
  public_id: string;
  category: string;
  brand: string;
  model: string;
  color: string;
  storage_capacity: string;
  serial_last4: string;
  imei_last4: string;
  purchase_date: string | null;
  purchase_source: string;
  purchase_condition: PurchaseCondition;
  declared_condition: DeclaredCondition;
  primary_image_path: string | null;
  status: AssetStatus;
  public_show_photo: boolean;
  public_show_purchase_year: boolean;
  public_show_serial_last4: boolean;
  current_owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Colonnes privées : ne sortent JAMAIS d'une lecture publique ou partagée. */
export interface AssetPrivateColumns {
  serial_number_private: string | null;
  imei_private: string | null;
}

export interface EventRow {
  id: string;
  asset_id: string;
  type: EventType;
  effective_date: string;
  title: string;
  description: string;
  author_user_id: string | null;
  author_role: AuthorRole;
  author_label: string;
  professional_id: string | null;
  trust_level: TrustLevel;
  cost_cents: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  replaced_event_id: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  asset_id: string;
  event_id: string | null;
  owner_user_id: string;
  kind: DocumentKind;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  transfer_policy: TransferPolicy;
  visible_to_owner: boolean;
  shared_until: string | null;
  status: "actif" | "archive";
  created_at: string;
  updated_at: string;
}

export interface MediaRow {
  id: string;
  asset_id: string;
  event_id: string | null;
  uploader_user_id: string | null;
  kind: "principale" | "etat" | "evenement";
  storage_path: string;
  caption: string;
  position: number;
  created_at: string;
}

export interface ShareLinkRow {
  id: string;
  asset_id: string;
  created_by: string;
  label: string;
  sections: ShareSection[];
  document_ids: string[];
  allow_download: boolean;
  show_serial_last4: boolean;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export interface TransferRow {
  id: string;
  asset_id: string;
  seller_id: string;
  recipient_email: string;
  buyer_id: string | null;
  status: TransferStatus;
  expires_at: string;
  options: { documents?: Record<string, TransferPolicy> };
  asset_summary: {
    public_id?: string;
    brand?: string;
    model?: string;
    color?: string;
  };
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalProfileRow {
  id: string;
  user_id: string;
  trade_name: string;
  legal_name: string;
  siret: string;
  address: string;
  postal_code: string;
  city: string;
  manager_name: string;
  contact_email: string;
  contact_phone: string;
  activity: ProActivity;
  proof_document_path: string | null;
  rules_accepted_at: string | null;
  status: ProStatus;
  decision_reason: string;
  decided_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalAccessRow {
  id: string;
  asset_id: string;
  professional_id: string;
  requested_by: string | null;
  granted_by: string | null;
  source: ProAccessSource;
  scope: "lecture" | "intervention";
  status: ProAccessStatus;
  message: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeRow {
  id: string;
  asset_id: string;
  event_id: string | null;
  reporter_id: string | null;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution: string;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  actor_role: "utilisateur" | "professionnel" | "administrateur" | "systeme";
  action: string;
  target_type: string;
  target_id: string | null;
  asset_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NidAdminRow {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "moderateur";
  is_active: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Vues applicatives                                                  */
/* ------------------------------------------------------------------ */

/** Ligne de la liste « Mes téléphones ». */
export interface AssetListItem {
  id: string;
  public_id: string;
  brand: string;
  model: string;
  color: string;
  status: AssetStatus;
  photo_url: string | null;
  last_event: { title: string; effective_date: string; trust_level: TrustLevel } | null;
  active_shares: number;
  events_count: number;
  health_state: HealthState;
  next_check_on: string | null;
  check_overdue: boolean;
}

/** Aperçu public minimal (aucune donnée personnelle). */
export interface PublicPreview {
  public_id: string;
  brand: string;
  model: string;
  color: string;
  status: AssetStatus;
  photo_path: string | null;
  purchase_year: number | null;
  serial_last4: string | null;
  events_total: number;
  events_professional: number;
  events_disputed: number;
  transfers_count: number;
  created_at: string;
}

/** Résultat de la résolution d'un lien de partage. */
export type ShareResolution =
  | { state: "introuvable" | "revoque" | "expire" }
  | {
      state: "valide";
      share: {
        id: string;
        label: string;
        sections: ShareSection[];
        allow_download: boolean;
        show_serial_last4: boolean;
        expires_at: string;
      };
      asset: {
        id: string;
        public_id: string;
        brand: string;
        model: string;
        color: string;
        storage_capacity: string;
        purchase_date: string | null;
        purchase_source: string;
        purchase_condition: PurchaseCondition;
        declared_condition: DeclaredCondition;
        status: AssetStatus;
        primary_image_path: string | null;
        serial_last4: string | null;
      };
      events: Array<
        Pick<
          EventRow,
          | "id"
          | "type"
          | "effective_date"
          | "title"
          | "description"
          | "author_role"
          | "author_label"
          | "trust_level"
          | "cost_cents"
          | "metadata"
          | "revoked_at"
        >
      >;
      media: Array<Pick<MediaRow, "id" | "storage_path" | "caption" | "kind">>;
      documents: Array<
        Pick<
          DocumentRow,
          "id" | "kind" | "original_name" | "mime_type" | "size_bytes" | "storage_path"
        >
      >;
    };

/** Résultat standard d'une Server Action (jamais de succès simulé). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

/* ================================================================== */
/*  V2 — espaces, affectations, bilans, réparations                    */
/* ================================================================== */

export interface WorkspaceRow {
  id: string;
  kind: WorkspaceKind;
  name: string;
  owner_user_id: string;
  timezone: string;
  plan: string;
  plan_status: "actif" | "impaye" | "annule";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  role: WorkspaceRole;
  status: "actif" | "invite" | "retire";
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** Espace + rôle de l'utilisateur courant (sélecteur d'espace). */
export interface WorkspaceContext {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
}

export interface AssignmentRow {
  id: string;
  asset_id: string;
  workspace_id: string;
  holder_user_id: string | null;
  holder_name: string;
  holder_email: string;
  kind: "affectation" | "pret";
  started_on: string;
  ended_on: string | null;
  status: "active" | "ended";
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckScheduleRow {
  id: string;
  asset_id: string;
  workspace_id: string | null;
  frequency_months: number;
  full_check_every: number;
  enabled: boolean;
  next_due_on: string;
  last_request_at: string | null;
  last_answer_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Le jeton haché n'est jamais exposé (privilèges colonne côté base). */
export interface CheckRequestRow {
  id: string;
  asset_id: string;
  workspace_id: string | null;
  campaign_id: string | null;
  recipient_user_id: string | null;
  recipient_name: string;
  recipient_email: string;
  scope: CheckScope;
  due_on: string;
  expires_at: string;
  sent_at: string | null;
  email_status: CheckEmailStatus;
  email_error: string;
  first_used_at: string | null;
  answered_at: string | null;
  revoked_at: string | null;
  checkup_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CheckupRow {
  id: string;
  asset_id: string;
  request_id: string | null;
  workspace_id: string | null;
  responder_user_id: string | null;
  responder_label: string;
  answer: CheckAnswer;
  details: Record<string, unknown>;
  comment: string;
  source_type: SourceType;
  event_id: string | null;
  answered_at: string;
  created_at: string;
}

export interface CheckCampaignRow {
  id: string;
  workspace_id: string;
  label: string;
  created_by: string | null;
  status: "en_cours" | "terminee";
  total: number;
  sent: number;
  manual: number;
  failed: number;
  created_at: string;
}

export interface RepairOrderRow {
  id: string;
  asset_id: string;
  workspace_id: string | null;
  requested_by: string | null;
  repairer_workspace_id: string | null;
  professional_id: string | null;
  repairer_label: string;
  status: RepairStatus;
  reported_problem: string;
  visual_state: string;
  diagnosis: string;
  operation: string;
  parts: string;
  parts_type: PartsType;
  amount_cents: number | null;
  warranty_months: number | null;
  intervened_on: string | null;
  comment: string;
  expires_at: string | null;
  claimed_at: string | null;
  submitted_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  refused_at: string | null;
  refusal_reason: string;
  event_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Colonnes V2 ajoutées à `nid_assets`. */
export interface AssetV2Columns {
  workspace_id: string | null;
  fleet_status: FleetStatus;
  health_state: HealthState;
  internal_reference: string;
  warranty_end: string | null;
  eprel_url: string | null;
}

/** Ligne du parc d'entreprise. */
export interface FleetItem {
  id: string;
  public_id: string;
  brand: string;
  model: string;
  color: string;
  internal_reference: string;
  serial_last4: string;
  imei_last4: string;
  fleet_status: FleetStatus;
  health_state: HealthState;
  warranty_end: string | null;
  holder_label: string | null;
  holder_email: string | null;
  assignment_id: string | null;
  last_checkup_at: string | null;
  next_check_on: string | null;
  check_overdue: boolean;
}

/** Réponse d'un bilan ouverte depuis un lien à jeton. */
export type CheckRequestResolution =
  | { state: "introuvable" | "revoque" | "expire" }
  | { state: "deja_repondu"; answer: CheckAnswer | null; answeredAt: string | null }
  | {
      state: "valide";
      request: {
        id: string;
        scope: CheckScope;
        due_on: string;
        expires_at: string;
        recipient_name: string;
        is_company: boolean;
      };
      device: { brand: string; model: string; color: string; public_id: string };
    };
