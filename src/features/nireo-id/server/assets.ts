import { logger } from "@/lib/logger";
import { computeCompleteness, type Completeness } from "../completeness";
import { MAX_CONDITION_PHOTOS, type HealthState } from "../constants";
import { fingerprint, last4, normalizeIdentifier } from "../identifiers";
import type { CreateAssetInput } from "../schemas";
import type {
  AssetListItem,
  AssetRow,
  DocumentRow,
  EventRow,
  MediaRow,
  ProfessionalAccessRow,
  ShareLinkRow,
  TransferRow,
} from "../types";
import { dbErrorMessage, isNireoIdConfigured, nidService, nidUserClient } from "./client";
import { nidSignedUrl, nidSignedUrlMap, removeNidFiles, uploadNidFile } from "./storage";

/**
 * Téléphones — lecture et écriture.
 *
 * Les lectures du propriétaire passent par SA session : c'est la RLS qui
 * garantit l'isolation (un utilisateur ne peut pas lire le téléphone d'un
 * autre, même en changeant l'UUID dans l'URL). La clé secrète n'est
 * utilisée que pour la création atomique et les URL signées.
 */

/* ------------------------------------------------------------------ */
/*  Liste                                                              */
/* ------------------------------------------------------------------ */

export async function listAssets(): Promise<AssetListItem[]> {
  if (!isNireoIdConfigured) return [];
  const supabase = await nidUserClient();

  const { data: assets, error } = await supabase
    .from("nid_assets")
    .select(
      "id, public_id, brand, model, color, status, primary_image_path, created_at, health_state"
    )
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("nireo-id/assets list", error);
    return [];
  }
  const rows = (assets ?? []) as (Pick<
    AssetRow,
    "id" | "public_id" | "brand" | "model" | "color" | "status" | "primary_image_path" | "created_at"
  > & { health_state: HealthState })[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const { data: schedules } = await supabase
    .from("nid_check_schedules")
    .select("asset_id, next_due_on")
    .in("asset_id", ids);
  const nextByAsset = new Map<string, string>();
  for (const item of (schedules ?? []) as { asset_id: string; next_due_on: string }[]) {
    nextByAsset.set(item.asset_id, item.next_due_on);
  }
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: events }, { data: shares }] = await Promise.all([
    supabase
      .from("nid_events")
      .select("asset_id, title, effective_date, trust_level, created_at")
      .in("asset_id", ids)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("nid_share_links")
      .select("asset_id, expires_at, revoked_at")
      .in("asset_id", ids)
      .is("revoked_at", null),
  ]);

  const lastEvent = new Map<string, AssetListItem["last_event"]>();
  const eventCount = new Map<string, number>();
  for (const event of (events ?? []) as Pick<
    EventRow,
    "asset_id" | "title" | "effective_date" | "trust_level"
  >[]) {
    eventCount.set(event.asset_id, (eventCount.get(event.asset_id) ?? 0) + 1);
    if (!lastEvent.has(event.asset_id)) {
      lastEvent.set(event.asset_id, {
        title: event.title,
        effective_date: event.effective_date,
        trust_level: event.trust_level,
      });
    }
  }

  const now = Date.now();
  const shareCount = new Map<string, number>();
  for (const share of (shares ?? []) as Pick<ShareLinkRow, "asset_id" | "expires_at">[]) {
    if (new Date(share.expires_at).getTime() > now) {
      shareCount.set(share.asset_id, (shareCount.get(share.asset_id) ?? 0) + 1);
    }
  }

  const urls = await nidSignedUrlMap(
    rows.map((row) => row.primary_image_path).filter((path): path is string => Boolean(path))
  );

  return rows.map((row) => {
    const next = nextByAsset.get(row.id) ?? null;
    return {
      id: row.id,
      public_id: row.public_id,
      brand: row.brand,
      model: row.model,
      color: row.color,
      status: row.status,
      photo_url: row.primary_image_path ? (urls.get(row.primary_image_path) ?? null) : null,
      last_event: lastEvent.get(row.id) ?? null,
      active_shares: shareCount.get(row.id) ?? 0,
      events_count: eventCount.get(row.id) ?? 0,
      health_state: row.health_state ?? "bon_etat",
      next_check_on: next,
      check_overdue: Boolean(next && next < today),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Détail                                                             */
/* ------------------------------------------------------------------ */

export interface AssetMedia extends MediaRow {
  url: string | null;
}

export interface AssetEvent extends EventRow {
  media: AssetMedia[];
  documents_count: number;
}

export interface AssetDetail {
  asset: AssetRow;
  serial_number: string | null;
  imei: string | null;
  photo_url: string | null;
  events: AssetEvent[];
  documents: DocumentRow[];
  media: AssetMedia[];
  /** Liens encore utilisables (ni révoqués, ni expirés) au moment de la lecture. */
  shares_active: ShareLinkRow[];
  /** Liens révoqués ou expirés — conservés pour la traçabilité. */
  shares_closed: ShareLinkRow[];
  pro_access: (ProfessionalAccessRow & { professional_name: string })[];
  pending_transfer: TransferRow | null;
  completeness: Completeness;
}

/** Détail complet d'un téléphone. `null` = inexistant OU pas à vous. */
export async function getAssetDetail(assetId: string): Promise<AssetDetail | null> {
  if (!isNireoIdConfigured) return null;
  const supabase = await nidUserClient();

  const { data: asset, error } = await supabase
    .from("nid_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (error || !asset) return null;

  const row = asset as AssetRow & { serial_number_private: string | null; imei_private: string | null };

  const [
    { data: events },
    { data: documents },
    { data: media },
    { data: shares },
    { data: access },
    { data: transfers },
  ] = await Promise.all([
    supabase
      .from("nid_events")
      .select("*")
      .eq("asset_id", assetId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("nid_documents")
      .select("*")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("nid_media")
      .select("*")
      .eq("asset_id", assetId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("nid_share_links")
      .select("*")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("nid_professional_access")
      .select("*")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("nid_transfers")
      .select("*")
      .eq("asset_id", assetId)
      .eq("status", "en_attente")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const mediaRows = (media ?? []) as MediaRow[];
  const documentRows = (documents ?? []) as DocumentRow[];
  const eventRows = (events ?? []) as EventRow[];
  const accessRows = (access ?? []) as ProfessionalAccessRow[];
  const shareRows = (shares ?? []) as ShareLinkRow[];
  const readAt = Date.now();

  const urlMap = await nidSignedUrlMap([
    ...mediaRows.map((item) => item.storage_path),
    ...(row.primary_image_path ? [row.primary_image_path] : []),
  ]);

  const withUrl = (item: MediaRow): AssetMedia => ({
    ...item,
    url: urlMap.get(item.storage_path) ?? null,
  });

  const documentsByEvent = new Map<string, number>();
  for (const document of documentRows) {
    if (document.event_id) {
      documentsByEvent.set(document.event_id, (documentsByEvent.get(document.event_id) ?? 0) + 1);
    }
  }

  // Nom commercial des professionnels concernés (lecture serveur : la fiche
  // pro n'est pas lisible par le propriétaire via la RLS).
  const professionalIds = [...new Set(accessRows.map((item) => item.professional_id))];
  const names = new Map<string, string>();
  if (professionalIds.length > 0) {
    const { data: pros } = await nidService()
      .from("nid_professional_profiles")
      .select("id, trade_name")
      .in("id", professionalIds);
    for (const pro of (pros ?? []) as { id: string; trade_name: string }[]) {
      names.set(pro.id, pro.trade_name);
    }
  }

  const hasProfessionalEvent = eventRows.some(
    (event) => event.trust_level === 2 && !event.revoked_at
  );

  return {
    asset: row,
    serial_number: row.serial_number_private,
    imei: row.imei_private,
    photo_url: row.primary_image_path ? (urlMap.get(row.primary_image_path) ?? null) : null,
    events: eventRows.map((event) => ({
      ...event,
      media: mediaRows.filter((item) => item.event_id === event.id).map(withUrl),
      documents_count: documentsByEvent.get(event.id) ?? 0,
    })),
    documents: documentRows,
    media: mediaRows.map(withUrl),
    shares_active: shareRows.filter(
      (share) => !share.revoked_at && new Date(share.expires_at).getTime() > readAt
    ),
    shares_closed: shareRows.filter(
      (share) => share.revoked_at || new Date(share.expires_at).getTime() <= readAt
    ),
    pro_access: accessRows.map((item) => ({
      ...item,
      professional_name: names.get(item.professional_id) ?? "Professionnel",
    })),
    pending_transfer: ((transfers ?? []) as TransferRow[])[0] ?? null,
    completeness: computeCompleteness({
      hasPhoto: Boolean(row.primary_image_path),
      hasIdentifier: Boolean(row.serial_last4 || row.imei_last4),
      hasPurchaseDate: Boolean(row.purchase_date),
      hasPurchaseProof: documentRows.some(
        (document) => document.kind === "facture" && document.status === "actif"
      ),
      hasDeclaredCondition: Object.keys(row.declared_condition ?? {}).length > 0,
      hasProfessionalEvent,
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Création                                                           */
/* ------------------------------------------------------------------ */

export interface CreateAssetFiles {
  primaryPhoto: File | null;
  conditionPhotos: File[];
  purchaseProof: File | null;
}

export interface CreatedAsset {
  id: string;
  public_id: string;
  next_check_on?: string;
}

/** Champs V2 (espace, garantie, référence interne, étiquette officielle). */
export interface CreateAssetExtras {
  workspaceId: string | null;
  warrantyEnd: string | null;
  internalReference: string;
  eprelUrl: string | null;
  checkFrequencyMonths: number;
}

/**
 * Crée un téléphone de bout en bout.
 *
 * Ordre volontaire : les fichiers sont envoyés AVANT l'écriture en base,
 * sous l'identifiant définitif du téléphone. Si la création en base
 * échoue, les fichiers déjà envoyés sont supprimés — aucune ligne
 * orpheline, aucun fichier abandonné dans le cas nominal.
 */
export async function createAsset(
  userId: string,
  input: CreateAssetInput,
  files: CreateAssetFiles,
  extras: CreateAssetExtras
): Promise<CreatedAsset> {
  const assetId = crypto.randomUUID();
  const supabase = await nidUserClient();
  const uploaded: string[] = [];

  try {
    let primaryPath: string | null = null;
    const mediaPayload: { kind: string; storage_path: string; caption: string; position: number }[] = [];
    const documentPayload: {
      kind: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      transfer_policy: string;
    }[] = [];

    if (files.primaryPhoto) {
      const file = await uploadNidFile(supabase, userId, assetId, "media", files.primaryPhoto);
      uploaded.push(file.storage_path);
      primaryPath = file.storage_path;
      mediaPayload.push({
        kind: "principale",
        storage_path: file.storage_path,
        caption: "",
        position: 0,
      });
    }

    const conditionPhotos = files.conditionPhotos.slice(0, MAX_CONDITION_PHOTOS);
    for (const [index, photo] of conditionPhotos.entries()) {
      const file = await uploadNidFile(supabase, userId, assetId, "media", photo);
      uploaded.push(file.storage_path);
      mediaPayload.push({
        kind: "etat",
        storage_path: file.storage_path,
        caption: "",
        position: index + 1,
      });
    }

    if (files.purchaseProof) {
      const file = await uploadNidFile(supabase, userId, assetId, "documents", files.purchaseProof);
      uploaded.push(file.storage_path);
      documentPayload.push({
        kind: "facture",
        storage_path: file.storage_path,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        transfer_policy: "prive",
      });
    }

    const serial = normalizeIdentifier(input.serial_number);
    const imei = normalizeIdentifier(input.imei);

    const payload = {
      brand: input.brand,
      model: input.model,
      color: input.color ?? "",
      storage_capacity: input.storage_capacity ?? "",
      serial_number: serial,
      serial_fingerprint: fingerprint(serial),
      serial_last4: last4(serial),
      imei,
      imei_fingerprint: fingerprint(imei),
      imei_last4: last4(imei),
      purchase_date: input.purchase_date || null,
      purchase_source: input.purchase_source ?? "",
      purchase_condition: input.purchase_condition,
      declared_condition: input.declared_condition ?? {},
      primary_image_path: primaryPath,
      media: mediaPayload,
      documents: documentPayload,
      // Champs V2 appliqués par `nid_create_asset_v2` après la création.
      internal_reference: extras.internalReference,
      warranty_end: extras.warrantyEnd ?? "",
      eprel_url: extras.eprelUrl ?? "",
      fleet_status: extras.workspaceId ? "en_stock" : "affecte",
      check_frequency_months: String(extras.checkFrequencyMonths),
    };

    const { data, error } = await nidService().rpc("nid_create_asset_v2", {
      p_owner_id: userId,
      p_asset_id: assetId,
      p_workspace_id: extras.workspaceId,
      p_payload: payload,
    });

    if (error) {
      throw new Error(dbErrorMessage(error, "La création du téléphone a échoué."));
    }

    const created = data as { id: string; public_id: string; next_check_on?: string };
    return {
      id: created.id,
      public_id: created.public_id,
      next_check_on: created.next_check_on,
    };
  } catch (error) {
    // Rien n'a été créé en base : on retire les fichiers déjà envoyés.
    await removeNidFiles(uploaded);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Modification                                                       */
/* ------------------------------------------------------------------ */

/** Caractéristiques du téléphone (colonnes autorisées uniquement). */
export async function updateAsset(
  assetId: string,
  values: {
    brand: string;
    model: string;
    color: string;
    storage_capacity: string;
    purchase_date: string | null;
    purchase_source: string;
    purchase_condition: string;
  }
): Promise<void> {
  const supabase = await nidUserClient();
  const { data, error } = await supabase
    .from("nid_assets")
    .update(values)
    .eq("id", assetId)
    .select("id");
  if (error) throw new Error(dbErrorMessage(error, "La mise à jour a échoué."));
  if (((data ?? []) as unknown[]).length === 0) {
    throw new Error("Ce téléphone ne vous appartient pas.");
  }
}

/** Ce que le propriétaire accepte de montrer sur l'aperçu public. */
export async function updatePublicVisibility(
  assetId: string,
  values: {
    public_show_photo: boolean;
    public_show_purchase_year: boolean;
    public_show_serial_last4: boolean;
  }
): Promise<void> {
  const supabase = await nidUserClient();
  const { data, error } = await supabase
    .from("nid_assets")
    .update(values)
    .eq("id", assetId)
    .select("id");
  if (error) throw new Error(dbErrorMessage(error, "La mise à jour a échoué."));
  if (((data ?? []) as unknown[]).length === 0) {
    throw new Error("Ce téléphone ne vous appartient pas.");
  }
}

/**
 * Archivage / réactivation. Le statut n'est pas modifiable par le
 * navigateur (privilèges colonne) : il passe par le serveur, après
 * vérification explicite du propriétaire.
 */
export async function setAssetArchived(
  userId: string,
  assetId: string,
  archived: boolean
): Promise<void> {
  const service = nidService();
  const { data: asset } = await service
    .from("nid_assets")
    .select("id, status, current_owner_id")
    .eq("id", assetId)
    .maybeSingle();
  const row = asset as { status: string; current_owner_id: string | null } | null;
  if (!row || row.current_owner_id !== userId) {
    throw new Error("Ce téléphone ne vous appartient pas.");
  }
  if (row.status === "transfer_pending") {
    throw new Error("Annulez le transfert en cours avant d'archiver ce téléphone.");
  }

  const { error } = await service
    .from("nid_assets")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", assetId)
    .eq("current_owner_id", userId);
  if (error) throw new Error(dbErrorMessage(error, "L'opération a échoué."));

  if (archived) {
    // Un téléphone archivé ne doit plus être consultable par un lien actif.
    await service
      .from("nid_share_links")
      .update({ revoked_at: new Date().toISOString(), revoked_by: userId })
      .eq("asset_id", assetId)
      .is("revoked_at", null);
  }
}

/**
 * Suppression définitive — refusée si le téléphone a déjà changé de mains :
 * on n'efface jamais un historique transmis à un autre propriétaire.
 */
export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  const service = nidService();
  const { data: asset } = await service
    .from("nid_assets")
    .select("id, current_owner_id, status")
    .eq("id", assetId)
    .maybeSingle();
  const row = asset as { current_owner_id: string | null; status: string } | null;
  if (!row || row.current_owner_id !== userId) {
    throw new Error("Ce téléphone ne vous appartient pas.");
  }
  if (row.status === "transfer_pending") {
    throw new Error("Annulez le transfert en cours avant de supprimer ce téléphone.");
  }

  const { count } = await service
    .from("nid_ownerships")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId);
  if ((count ?? 0) > 1) {
    throw new Error(
      "Ce téléphone a déjà changé de propriétaire : son historique ne peut pas être effacé. " +
        "Vous pouvez l'archiver."
    );
  }

  const [{ data: media }, { data: documents }] = await Promise.all([
    service.from("nid_media").select("storage_path").eq("asset_id", assetId),
    service.from("nid_documents").select("storage_path").eq("asset_id", assetId),
  ]);
  const paths = [
    ...((media ?? []) as { storage_path: string }[]),
    ...((documents ?? []) as { storage_path: string }[]),
  ].map((row_) => row_.storage_path);

  const { error } = await service.from("nid_assets").delete().eq("id", assetId);
  if (error) throw new Error(dbErrorMessage(error, "La suppression a échoué."));
  await removeNidFiles(paths);
}

/* ------------------------------------------------------------------ */
/*  Photo principale                                                   */
/* ------------------------------------------------------------------ */

/** URL signée d'un chemin — après vérification des droits par l'appelant. */
export async function assetPhotoUrl(path: string | null): Promise<string | null> {
  return nidSignedUrl(path);
}
