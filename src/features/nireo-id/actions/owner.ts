"use server";

import { revalidatePath } from "next/cache";
import { CONDITION_POINTS, EPREL_HOSTS, MANAGING_ROLES, type ConditionGrade } from "../constants";
import {
  createAssetSchema,
  createShareSchema,
  createTransferSchema,
  disputeSchema,
  documentMetaSchema,
  documentPolicySchema,
  inviteProfessionalSchema,
  ownerEventSchema,
  proAccessDecisionSchema,
  publicIdSchema,
  publicVisibilitySchema,
  revokeEventSchema,
  updateAssetSchema,
} from "../schemas";
import type { ActionResult } from "../types";
import {
  createAsset,
  deleteAsset,
  setAssetArchived,
  updateAsset,
  updatePublicVisibility,
} from "../server/assets";
import {
  addDocument,
  addOwnerEvent,
  deleteDocument,
  getDocumentUrl,
  reportDispute,
  revokeEventAsOwner,
  updateDocumentPolicy,
} from "../server/events";
import { nidUserClient } from "../server/client";
import { requireNidUser } from "../server/guards";
import { decideAccess, inviteProfessional } from "../server/professionals";
import { createShare, revokeShare } from "../server/sharing";
import {
  acceptErrorMessage,
  acceptTransfer,
  cancelTransfer,
  createTransfer,
  declineTransfer,
} from "../server/transfers";
import { ensurePersonalWorkspace, requireWorkspaceRole } from "../server/workspaces";
import { bool, fail, file, files, list, numberOrNull, ok, parseInput, run, text } from "./helpers";

/**
 * Étiquette énergétique européenne : on ne conserve l'URL que si elle
 * pointe réellement vers un domaine officiel. Aucune caractéristique n'est
 * inventée à partir de ce lien.
 */
function normalizeEprelUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return (EPREL_HOSTS as readonly string[]).includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Server Actions du parcours PROPRIÉTAIRE.
 *
 * Chaque action : session vérifiée côté serveur → validation Zod →
 * opération réelle en base → revalidation de la page. Aucun retour
 * « succès » n'est produit sans confirmation du serveur.
 */

const APP = "/id/app";

/* ------------------------------------------------------------------ */
/*  Création d'un téléphone                                            */
/* ------------------------------------------------------------------ */

export async function createAssetAction(
  form: FormData
): Promise<ActionResult<{ id: string; public_id: string }>> {
  return run("owner/create-asset", async () => {
    const session = await requireNidUser();

    const condition: Record<string, ConditionGrade | string | number | null> = {};
    for (const point of CONDITION_POINTS) {
      const value = text(form, `condition_${point.key}`);
      if (value) condition[point.key] = value as ConditionGrade;
    }
    const battery = numberOrNull(form, "battery_health");
    if (battery !== null) condition.battery_health = battery;
    const comment = text(form, "condition_comment");
    if (comment) condition.comment = comment;

    const parsed = parseInput(createAssetSchema, {
      brand: text(form, "brand"),
      model: text(form, "model"),
      color: text(form, "color"),
      storage_capacity: text(form, "storage_capacity"),
      serial_number: text(form, "serial_number"),
      imei: text(form, "imei"),
      purchase_date: text(form, "purchase_date"),
      purchase_source: text(form, "purchase_source"),
      purchase_condition: text(form, "purchase_condition") || "inconnu",
      declared_condition: Object.keys(condition).length > 0 ? condition : undefined,
      consent_accuracy: bool(form, "consent_accuracy"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    // Espace de destination : personnel par défaut, entreprise si l'écran
    // d'ajout a été ouvert depuis un espace où l'utilisateur gère le parc.
    const requestedWorkspace = text(form, "workspace_id");
    let workspaceId: string | null = await ensurePersonalWorkspace(
      session.user.id,
      session.email
    );
    if (requestedWorkspace) {
      const context = await requireWorkspaceRole(
        session.user.id,
        requestedWorkspace,
        MANAGING_ROLES
      );
      workspaceId = context.workspace.id;
    }

    const frequency = Number(text(form, "check_frequency_months") || "1");

    const created = await createAsset(
      session.user.id,
      parsed.value,
      {
        primaryPhoto: file(form, "primary_photo"),
        conditionPhotos: files(form, "condition_photos"),
        purchaseProof: file(form, "purchase_proof"),
      },
      {
        workspaceId,
        warrantyEnd: text(form, "warranty_end") || null,
        internalReference: text(form, "internal_reference"),
        eprelUrl: normalizeEprelUrl(text(form, "eprel_url")),
        checkFrequencyMonths: Number.isFinite(frequency) ? Math.min(12, Math.max(1, frequency)) : 1,
      }
    );

    revalidatePath(APP);
    if (requestedWorkspace) revalidatePath(`/id/entreprise/${requestedWorkspace}/parc`);
    return ok(created);
  });
}

/* ------------------------------------------------------------------ */
/*  Modification                                                       */
/* ------------------------------------------------------------------ */

export async function updateAssetAction(form: FormData): Promise<ActionResult> {
  return run("owner/update-asset", async () => {
    await requireNidUser();
    const parsed = parseInput(updateAssetSchema, {
      asset_id: text(form, "asset_id"),
      brand: text(form, "brand"),
      model: text(form, "model"),
      color: text(form, "color"),
      storage_capacity: text(form, "storage_capacity"),
      purchase_date: text(form, "purchase_date"),
      purchase_source: text(form, "purchase_source"),
      purchase_condition: text(form, "purchase_condition") || "inconnu",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await updateAsset(parsed.value.asset_id, {
      brand: parsed.value.brand,
      model: parsed.value.model,
      color: parsed.value.color,
      storage_capacity: parsed.value.storage_capacity,
      purchase_date: parsed.value.purchase_date || null,
      purchase_source: parsed.value.purchase_source,
      purchase_condition: parsed.value.purchase_condition,
    });

    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok();
  });
}

export async function updateVisibilityAction(form: FormData): Promise<ActionResult> {
  return run("owner/visibility", async () => {
    await requireNidUser();
    const parsed = parseInput(publicVisibilitySchema, {
      asset_id: text(form, "asset_id"),
      public_show_photo: bool(form, "public_show_photo"),
      public_show_purchase_year: bool(form, "public_show_purchase_year"),
      public_show_serial_last4: bool(form, "public_show_serial_last4"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await updatePublicVisibility(parsed.value.asset_id, {
      public_show_photo: parsed.value.public_show_photo,
      public_show_purchase_year: parsed.value.public_show_purchase_year,
      public_show_serial_last4: parsed.value.public_show_serial_last4,
    });

    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok();
  });
}

export async function archiveAssetAction(form: FormData): Promise<ActionResult> {
  return run("owner/archive", async () => {
    const session = await requireNidUser();
    const assetId = text(form, "asset_id");
    if (!assetId) return fail("Téléphone introuvable.");
    await setAssetArchived(session.user.id, assetId, bool(form, "archived"));
    revalidatePath(APP);
    revalidatePath(`${APP}/objets/${assetId}`);
    return ok();
  });
}

export async function deleteAssetAction(form: FormData): Promise<ActionResult> {
  return run("owner/delete", async () => {
    const session = await requireNidUser();
    const assetId = text(form, "asset_id");
    if (!assetId) return fail("Téléphone introuvable.");
    await deleteAsset(session.user.id, assetId);
    revalidatePath(APP);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Historique                                                         */
/* ------------------------------------------------------------------ */

export async function addEventAction(form: FormData): Promise<ActionResult> {
  return run("owner/add-event", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(ownerEventSchema, {
      asset_id: text(form, "asset_id"),
      type: text(form, "type"),
      effective_date: text(form, "effective_date"),
      title: text(form, "title"),
      description: text(form, "description"),
      cost_euros: numberOrNull(form, "cost_euros"),
      parts: text(form, "parts"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await addOwnerEvent(session.user.id, parsed.value, {
      photos: files(form, "photos"),
      document: file(form, "document"),
    });

    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok();
  });
}

export async function revokeEventAction(form: FormData): Promise<ActionResult> {
  return run("owner/revoke-event", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(revokeEventSchema, {
      event_id: text(form, "event_id"),
      reason: text(form, "reason"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await revokeEventAsOwner(session.user.id, parsed.value.event_id, parsed.value.reason);
    revalidatePath(`${APP}/objets/${text(form, "asset_id")}`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

export async function addDocumentAction(form: FormData): Promise<ActionResult> {
  return run("owner/add-document", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(documentMetaSchema, {
      asset_id: text(form, "asset_id"),
      kind: text(form, "kind"),
      transfer_policy: text(form, "transfer_policy") || "prive",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const upload = file(form, "document");
    if (!upload) return fail("Sélectionnez un fichier à envoyer.", "document");

    await addDocument(
      session.user.id,
      parsed.value.asset_id,
      parsed.value.kind,
      parsed.value.transfer_policy,
      upload
    );

    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok();
  });
}

export async function documentUrlAction(
  documentId: string
): Promise<ActionResult<{ url: string }>> {
  return run("owner/document-url", async () => {
    await requireNidUser();
    const url = await getDocumentUrl(documentId);
    if (!url) return fail("Ce document n'est pas accessible.");
    return ok({ url });
  });
}

export async function updateDocumentPolicyAction(form: FormData): Promise<ActionResult> {
  return run("owner/document-policy", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(documentPolicySchema, {
      document_id: text(form, "document_id"),
      transfer_policy: text(form, "transfer_policy"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await updateDocumentPolicy(
      session.user.id,
      parsed.value.document_id,
      parsed.value.transfer_policy
    );
    revalidatePath(`${APP}/objets/${text(form, "asset_id")}`);
    return ok();
  });
}

export async function deleteDocumentAction(form: FormData): Promise<ActionResult> {
  return run("owner/delete-document", async () => {
    const session = await requireNidUser();
    const documentId = text(form, "document_id");
    if (!documentId) return fail("Document introuvable.");
    await deleteDocument(session.user.id, documentId);
    revalidatePath(`${APP}/objets/${text(form, "asset_id")}`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Partage                                                            */
/* ------------------------------------------------------------------ */

export async function createShareAction(
  form: FormData
): Promise<ActionResult<{ url: string; expires_at: string }>> {
  return run("owner/create-share", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(createShareSchema, {
      asset_id: text(form, "asset_id"),
      label: text(form, "label"),
      duration_hours: Number(text(form, "duration_hours")),
      sections: list(form, "sections"),
      document_ids: list(form, "document_ids"),
      allow_download: bool(form, "allow_download"),
      show_serial_last4: bool(form, "show_serial_last4"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const share = await createShare(session.user.id, parsed.value);
    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    revalidatePath(`${APP}/partages`);
    return ok({ url: share.url, expires_at: share.expires_at });
  });
}

export async function revokeShareAction(form: FormData): Promise<ActionResult> {
  return run("owner/revoke-share", async () => {
    const session = await requireNidUser();
    const shareId = text(form, "share_id");
    if (!shareId) return fail("Lien introuvable.");
    await revokeShare(session.user.id, shareId);
    revalidatePath(`${APP}/partages`);
    revalidatePath(`${APP}/objets/${text(form, "asset_id")}`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Transferts                                                         */
/* ------------------------------------------------------------------ */

export async function createTransferAction(
  form: FormData
): Promise<ActionResult<{ url: string; email_sent: boolean; expires_at: string }>> {
  return run("owner/create-transfer", async () => {
    const session = await requireNidUser();

    const policies: Record<string, string> = {};
    for (const entry of list(form, "document_policy")) {
      const [documentId, policy] = entry.split(":");
      if (documentId && policy) policies[documentId] = policy;
    }

    const parsed = parseInput(createTransferSchema, {
      asset_id: text(form, "asset_id"),
      recipient_email: text(form, "recipient_email"),
      document_policies: policies,
      confirm: bool(form, "confirm"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const transfer = await createTransfer(session.user.id, parsed.value, session.email);
    revalidatePath(`${APP}/transferts`);
    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok({
      url: transfer.url,
      email_sent: transfer.email_sent,
      expires_at: transfer.expires_at,
    });
  });
}

export async function cancelTransferAction(form: FormData): Promise<ActionResult> {
  return run("owner/cancel-transfer", async () => {
    const session = await requireNidUser();
    const transferId = text(form, "transfer_id");
    if (!transferId) return fail("Transfert introuvable.");
    await cancelTransfer(session.user.id, transferId);
    revalidatePath(`${APP}/transferts`);
    return ok();
  });
}

export async function acceptTransferAction(
  form: FormData
): Promise<ActionResult<{ asset_id: string }>> {
  return run("owner/accept-transfer", async () => {
    const session = await requireNidUser();
    const token = text(form, "token");
    if (!token) return fail("Invitation introuvable.");

    const result = await acceptTransfer(token, session.user.id, session.email);
    if (result.state !== "accepte") return fail(acceptErrorMessage(result.state));

    revalidatePath(APP);
    revalidatePath(`${APP}/transferts`);
    return ok({ asset_id: result.asset_id });
  });
}

export async function declineTransferAction(form: FormData): Promise<ActionResult> {
  return run("owner/decline-transfer", async () => {
    const session = await requireNidUser();
    const token = text(form, "token");
    if (!token) return fail("Invitation introuvable.");
    await declineTransfer(token, session.user.id, session.email);
    revalidatePath(`${APP}/transferts`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Accès professionnels et signalements                               */
/* ------------------------------------------------------------------ */

export async function decideAccessAction(form: FormData): Promise<ActionResult> {
  return run("owner/decide-access", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(proAccessDecisionSchema, {
      access_id: text(form, "access_id"),
      decision: text(form, "decision"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await decideAccess(session.user.id, parsed.value.access_id, parsed.value.decision);
    revalidatePath(`${APP}/objets/${text(form, "asset_id")}`);
    return ok();
  });
}

export async function inviteProfessionalAction(
  form: FormData
): Promise<ActionResult<{ email_sent: boolean }>> {
  return run("owner/invite-pro", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(inviteProfessionalSchema, {
      asset_id: text(form, "asset_id"),
      professional_email: text(form, "professional_email"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const result = await inviteProfessional(
      session.user.id,
      parsed.value.asset_id,
      parsed.value.professional_email
    );
    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok(result);
  });
}

/**
 * Recherche par identifiant Nireo (saisie manuelle ou scan).
 * La vérification « est-ce l'un de mes téléphones ? » utilise la session de
 * l'utilisateur (RLS) : aucune énumération de la base n'est possible.
 */
export async function resolveIdentifierAction(
  form: FormData
): Promise<ActionResult<{ href: string; owned: boolean }>> {
  return run("owner/resolve-identifier", async () => {
    await requireNidUser();
    const parsed = parseInput(publicIdSchema, text(form, "public_id"));
    if (!parsed.ok) return fail(parsed.error, "public_id");

    const supabase = await nidUserClient();
    const { data } = await supabase
      .from("nid_assets")
      .select("id")
      .eq("public_id", parsed.value)
      .maybeSingle();

    const owned = Boolean(data);
    return ok({
      href: owned
        ? `${APP}/objets/${(data as { id: string }).id}`
        : `/id/p/${parsed.value}`,
      owned,
    });
  });
}

export async function reportDisputeAction(form: FormData): Promise<ActionResult> {
  return run("owner/dispute", async () => {
    const session = await requireNidUser();
    const eventId = text(form, "event_id");
    const parsed = parseInput(disputeSchema, {
      asset_id: text(form, "asset_id"),
      event_id: eventId || null,
      reason: text(form, "reason"),
      description: text(form, "description"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await reportDispute(session.user.id, parsed.value);
    revalidatePath(`${APP}/objets/${parsed.value.asset_id}`);
    return ok();
  });
}
