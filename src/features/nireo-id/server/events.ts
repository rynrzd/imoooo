import type { z } from "zod";
import { MAX_CONDITION_PHOTOS } from "../constants";
import type { disputeSchema, ownerEventSchema } from "../schemas";
import type { DocumentRow } from "../types";
import { dbErrorMessage, nidService, nidUserClient } from "./client";
import { recordNidAudit } from "./audit";
import { nidSignedUrl, removeNidFiles, uploadNidFile } from "./storage";

/**
 * Historique d'un passeport : événements déclarés, documents, signalements.
 *
 * Un événement déclaré par le propriétaire porte TOUJOURS le niveau
 * « Déclaré » (0). Seul le serveur peut poser « Validé par un
 * professionnel », et seule une révocation motivée peut retirer une
 * information — jamais une suppression silencieuse.
 */

type OwnerEventInput = z.infer<typeof ownerEventSchema>;
type DisputeInput = z.infer<typeof disputeSchema>;

export interface OwnerEventFiles {
  photos: File[];
  document: File | null;
}

export async function addOwnerEvent(
  userId: string,
  input: OwnerEventInput,
  files: OwnerEventFiles
): Promise<{ event_id: string }> {
  const supabase = await nidUserClient();
  const uploaded: string[] = [];

  try {
    const mediaPayload: { storage_path: string; caption: string; position: number }[] = [];
    const documentPayload: {
      kind: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      transfer_policy: string;
    }[] = [];

    for (const [index, photo] of files.photos.slice(0, MAX_CONDITION_PHOTOS).entries()) {
      const file = await uploadNidFile(supabase, userId, input.asset_id, "media", photo);
      uploaded.push(file.storage_path);
      mediaPayload.push({ storage_path: file.storage_path, caption: "", position: index });
    }

    if (files.document) {
      const file = await uploadNidFile(supabase, userId, input.asset_id, "documents", files.document);
      uploaded.push(file.storage_path);
      documentPayload.push({
        kind: input.type === "garantie" ? "garantie" : "autre",
        storage_path: file.storage_path,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        transfer_policy: "prive",
      });
    }

    const { data, error } = await nidService().rpc("nid_add_owner_event", {
      p_owner_id: userId,
      p_asset_id: input.asset_id,
      p_payload: {
        type: input.type,
        effective_date: input.effective_date,
        title: input.title,
        description: input.description,
        cost_cents:
          input.cost_euros === null || input.cost_euros === undefined
            ? ""
            : String(Math.round(input.cost_euros * 100)),
        metadata: { parts: input.parts },
        media: mediaPayload,
        documents: documentPayload,
      },
    });

    if (error) throw new Error(dbErrorMessage(error, "L'ajout de l'événement a échoué."));
    const result = data as { state: string; event_id?: string };
    if (result.state === "non_proprietaire") {
      throw new Error("Ce passeport ne vous appartient pas.");
    }
    return { event_id: result.event_id as string };
  } catch (error) {
    await removeNidFiles(uploaded);
    throw error;
  }
}

/** Révocation motivée par le propriétaire ou l'auteur professionnel. */
export async function revokeEventAsOwner(
  userId: string,
  eventId: string,
  reason: string
): Promise<void> {
  const supabase = await nidUserClient();
  // La RLS ne laisse lire que les événements des passeports de l'utilisateur.
  const { data: event } = await supabase
    .from("nid_events")
    .select("id, asset_id, author_role, revoked_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Cet événement est introuvable.");

  const row = event as { id: string; asset_id: string; author_role: string; revoked_at: string | null };
  if (row.revoked_at) throw new Error("Cet événement est déjà révoqué.");
  if (row.author_role === "professionnel") {
    throw new Error(
      "Un événement validé par un professionnel ne peut être révoqué que par ce professionnel " +
        "ou par l'équipe Nireo. Signalez-le si vous le contestez."
    );
  }

  const { data, error } = await nidService().rpc("nid_revoke_event", {
    p_event_id: eventId,
    p_actor_user_id: userId,
    p_actor_role: "utilisateur",
    p_reason: reason,
  });
  if (error) throw new Error(dbErrorMessage(error, "La révocation a échoué."));
  const result = data as { state: string };
  if (result.state === "deja_revoque") throw new Error("Cet événement est déjà révoqué.");
}

/** Révocation par le professionnel auteur (correction traçable). */
export async function revokeEventAsProfessional(
  userId: string,
  professionalId: string,
  eventId: string,
  reason: string
): Promise<void> {
  const service = nidService();
  const { data: event } = await service
    .from("nid_events")
    .select("id, professional_id, revoked_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Cet événement est introuvable.");
  const row = event as { professional_id: string | null; revoked_at: string | null };
  if (row.professional_id !== professionalId) {
    throw new Error("Vous ne pouvez révoquer que vos propres interventions.");
  }
  if (row.revoked_at) throw new Error("Cette intervention est déjà révoquée.");

  const { error } = await service.rpc("nid_revoke_event", {
    p_event_id: eventId,
    p_actor_user_id: userId,
    p_actor_role: "professionnel",
    p_reason: reason,
  });
  if (error) throw new Error(dbErrorMessage(error, "La révocation a échoué."));
}

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

export async function addDocument(
  userId: string,
  assetId: string,
  kind: string,
  transferPolicy: string,
  file: File
): Promise<DocumentRow> {
  const supabase = await nidUserClient();
  const uploaded = await uploadNidFile(supabase, userId, assetId, "documents", file);

  const { data, error } = await supabase
    .from("nid_documents")
    .insert({
      asset_id: assetId,
      owner_user_id: userId,
      kind,
      storage_path: uploaded.storage_path,
      original_name: uploaded.original_name,
      mime_type: uploaded.mime_type,
      size_bytes: uploaded.size_bytes,
      transfer_policy: transferPolicy,
    })
    .select("*")
    .single();

  if (error || !data) {
    await removeNidFiles([uploaded.storage_path]);
    throw new Error(dbErrorMessage(error, "L'enregistrement du document a échoué."));
  }

  await recordNidAudit({
    actorUserId: userId,
    action: "document.added",
    targetType: "document",
    targetId: (data as DocumentRow).id,
    assetId,
  });

  return data as DocumentRow;
}

/**
 * URL signée d'un document. La lecture passe par la session de
 * l'utilisateur : la RLS décide s'il a le droit de voir ce document.
 */
export async function getDocumentUrl(documentId: string): Promise<string | null> {
  const supabase = await nidUserClient();
  const { data } = await supabase
    .from("nid_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!data) return null;
  return nidSignedUrl((data as { storage_path: string }).storage_path);
}

export async function updateDocumentPolicy(
  userId: string,
  documentId: string,
  policy: string
): Promise<void> {
  const supabase = await nidUserClient();
  const { data, error } = await supabase
    .from("nid_documents")
    .update({ transfer_policy: policy })
    .eq("id", documentId)
    .eq("owner_user_id", userId)
    .select("id");
  if (error) throw new Error(dbErrorMessage(error, "La mise à jour a échoué."));
  if (((data ?? []) as unknown[]).length === 0) {
    throw new Error("Ce document ne vous appartient pas.");
  }
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const supabase = await nidUserClient();
  const { data: document } = await supabase
    .from("nid_documents")
    .select("id, storage_path, asset_id, owner_user_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) throw new Error("Ce document est introuvable.");
  const row = document as DocumentRow;
  if (row.owner_user_id !== userId) {
    throw new Error("Ce document ne vous appartient pas.");
  }

  const { error } = await supabase.from("nid_documents").delete().eq("id", documentId);
  if (error) throw new Error(dbErrorMessage(error, "La suppression a échoué."));
  await removeNidFiles([row.storage_path]);

  await recordNidAudit({
    actorUserId: userId,
    action: "document.deleted",
    targetType: "document",
    targetId: documentId,
    assetId: row.asset_id,
  });
}

/* ------------------------------------------------------------------ */
/*  Signalements                                                       */
/* ------------------------------------------------------------------ */

/**
 * Un signalement peut être déposé par toute personne connectée ayant eu
 * accès au passeport (propriétaire, acheteur, professionnel). Il n'ouvre
 * aucun droit de lecture supplémentaire.
 */
export async function reportDispute(userId: string, input: DisputeInput): Promise<void> {
  const service = nidService();
  const { data: asset } = await service
    .from("nid_assets")
    .select("id")
    .eq("id", input.asset_id)
    .maybeSingle();
  if (!asset) throw new Error("Ce passeport est introuvable.");

  const { error } = await service.from("nid_disputes").insert({
    asset_id: input.asset_id,
    event_id: input.event_id ?? null,
    reporter_id: userId,
    reason: input.reason,
    description: input.description,
    status: "ouvert",
  });
  if (error) throw new Error(dbErrorMessage(error, "Le signalement n'a pas pu être enregistré."));

  await recordNidAudit({
    actorUserId: userId,
    action: "dispute.reported",
    targetType: "asset",
    targetId: input.asset_id,
    assetId: input.asset_id,
    metadata: { reason: input.reason },
  });
}
