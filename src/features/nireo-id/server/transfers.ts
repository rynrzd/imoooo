import type { z } from "zod";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/supabase/config";
import { TRANSFER_EXPIRY_DAYS, type TransferPolicy } from "../constants";
import { createToken, hashToken } from "../identifiers";
import type { createTransferSchema } from "../schemas";
import type { AssetRow, TransferRow } from "../types";
import { dbErrorMessage, isNireoIdConfigured, nidService, nidUserClient } from "./client";
import { recordNidAudit } from "./audit";
import { notifyTransferInvitation } from "./emails";

/**
 * Transfert de propriété.
 *
 * Le vendeur ouvre une demande (un seul transfert actif par objet, 7 jours
 * de validité). L'acheteur doit être CONNECTÉ avec l'adresse destinataire.
 * L'acceptation est entièrement réalisée par la fonction SQL
 * `nid_accept_transfer` : tout réussit ou tout est annulé, et une double
 * acceptation n'aboutit qu'une seule fois (verrou FOR UPDATE).
 */

type CreateTransferInput = z.infer<typeof createTransferSchema>;

/** Politique de transfert choisie document par document. */
type TransferPolicyMap = Record<string, TransferPolicy>;

export interface CreatedTransfer {
  id: string;
  url: string;
  expires_at: string;
  email_sent: boolean;
}

export function transferUrl(token: string): string {
  return `${SITE_URL}/id/app/transferts/${token}`;
}

export async function createTransfer(
  userId: string,
  input: CreateTransferInput,
  sellerEmail: string
): Promise<CreatedTransfer> {
  if (input.recipient_email === sellerEmail.toLowerCase()) {
    throw new Error("Vous ne pouvez pas transférer un téléphone vers votre propre adresse.");
  }

  const supabase = await nidUserClient();

  // Le Téléphone doit être à vous, actif, et sans transfert en cours.
  const { data: asset } = await supabase
    .from("nid_assets")
    .select("id, public_id, brand, model, color, status")
    .eq("id", input.asset_id)
    .maybeSingle();
  if (!asset) throw new Error("Ce téléphone est introuvable ou ne vous appartient plus.");
  const row = asset as Pick<AssetRow, "id" | "public_id" | "brand" | "model" | "color" | "status">;
  if (row.status === "transfer_pending") {
    throw new Error("Un transfert est déjà en cours pour ce téléphone.");
  }
  if (row.status === "archived") {
    throw new Error("Ce téléphone est archivé : réactivez-le avant de le transférer.");
  }

  // Politique de transfert par document : on ne conserve que les documents
  // qui appartiennent réellement à ce téléphone et à ce vendeur.
  const { data: documents } = await supabase
    .from("nid_documents")
    .select("id")
    .eq("asset_id", input.asset_id)
    .eq("owner_user_id", userId)
    .eq("status", "actif");

  const policies: TransferPolicyMap = {};
  for (const document of (documents ?? []) as { id: string }[]) {
    policies[document.id] = input.document_policies[document.id] ?? "prive";
  }

  const token = createToken();
  const expiresAt = new Date(Date.now() + TRANSFER_EXPIRY_DAYS * 86400 * 1000);
  const service = nidService();

  const { data: created, error } = await service
    .from("nid_transfers")
    .insert({
      asset_id: input.asset_id,
      seller_id: userId,
      recipient_email: input.recipient_email,
      token_hash: hashToken(token),
      status: "en_attente",
      expires_at: expiresAt.toISOString(),
      options: { documents: policies },
      asset_summary: {
        public_id: row.public_id,
        brand: row.brand,
        model: row.model,
        color: row.color,
      },
    })
    .select("id, expires_at")
    .single();

  if (error || !created) {
    throw new Error(dbErrorMessage(error, "L'ouverture du transfert a échoué."));
  }

  // Politique appliquée aux documents dès l'ouverture : le choix du
  // vendeur est enregistré, l'effet réel a lieu à l'acceptation.
  for (const [documentId, policy] of Object.entries(policies)) {
    await service
      .from("nid_documents")
      .update({ transfer_policy: policy })
      .eq("id", documentId)
      .eq("owner_user_id", userId);
  }

  await service
    .from("nid_assets")
    .update({ status: "transfer_pending" })
    .eq("id", input.asset_id)
    .eq("current_owner_id", userId);

  const url = transferUrl(token);
  const emailSent = await notifyTransferInvitation({
    to: input.recipient_email,
    deviceLabel: `${row.brand} ${row.model}`,
    url,
    expiresLabel: expiresAt.toLocaleDateString("fr-FR"),
  });

  await recordNidAudit({
    actorUserId: userId,
    action: "transfer.created",
    targetType: "transfer",
    targetId: created.id as string,
    assetId: input.asset_id,
    metadata: { email_sent: emailSent },
  });

  return {
    id: created.id as string,
    url,
    expires_at: created.expires_at as string,
    email_sent: emailSent,
  };
}

/* ------------------------------------------------------------------ */
/*  Consultation                                                       */
/* ------------------------------------------------------------------ */

export interface TransferLists {
  sent: TransferRow[];
  received: TransferRow[];
}

export async function listTransfers(userEmail: string): Promise<TransferLists> {
  if (!isNireoIdConfigured) return { sent: [], received: [] };
  const supabase = await nidUserClient();
  const { data, error } = await supabase
    .from("nid_transfers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("nireo-id/transfers list", error);
    return { sent: [], received: [] };
  }
  const rows = (data ?? []) as TransferRow[];
  const email = userEmail.toLowerCase();
  return {
    sent: rows.filter((row) => row.recipient_email.toLowerCase() !== email),
    received: rows.filter((row) => row.recipient_email.toLowerCase() === email),
  };
}

export interface TransferInvitation {
  state: "valide" | "expire" | "deja_traite" | "introuvable" | "destinataire_different";
  transfer?: TransferRow;
}

/**
 * Lit une invitation à partir de son jeton, pour la page d'acceptation.
 * Ne renvoie jamais le contenu privé du téléphone : uniquement le résumé
 * enregistré à l'ouverture (marque, modèle, identifiant public).
 */
export async function getTransferByToken(
  token: string,
  userEmail: string
): Promise<TransferInvitation> {
  if (!isNireoIdConfigured || !token) return { state: "introuvable" };
  const { data, error } = await nidService()
    .from("nid_transfers")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error || !data) return { state: "introuvable" };

  const transfer = data as TransferRow;
  if (transfer.recipient_email.toLowerCase() !== userEmail.toLowerCase()) {
    return { state: "destinataire_different" };
  }
  if (transfer.status !== "en_attente") return { state: "deja_traite", transfer };
  if (new Date(transfer.expires_at).getTime() <= Date.now()) {
    return { state: "expire", transfer };
  }
  return { state: "valide", transfer };
}

/* ------------------------------------------------------------------ */
/*  Décisions                                                          */
/* ------------------------------------------------------------------ */

export type AcceptResult =
  | { state: "accepte"; asset_id: string; public_id: string }
  | {
      state:
        | "introuvable"
        | "expire"
        | "deja_traite"
        | "destinataire_different"
        | "auto_transfert"
        | "vendeur_plus_proprietaire";
      status?: string;
    };

const ACCEPT_MESSAGES: Record<string, string> = {
  introuvable: "Cette invitation de transfert n'existe pas ou a été annulée.",
  expire: "Cette invitation a expiré. Demandez au vendeur d'en générer une nouvelle.",
  deja_traite: "Cette demande de transfert a déjà été traitée.",
  destinataire_different:
    "Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec l'adresse destinataire.",
  auto_transfert: "Vous ne pouvez pas accepter un transfert que vous avez vous-même ouvert.",
  vendeur_plus_proprietaire:
    "Le vendeur n'est plus le propriétaire de ce téléphone : la demande a été annulée.",
};

export function acceptErrorMessage(state: string): string {
  return ACCEPT_MESSAGES[state] ?? "Le transfert n'a pas pu être finalisé.";
}

/** Acceptation ATOMIQUE (fonction SQL). Idempotente par verrou. */
export async function acceptTransfer(
  token: string,
  userId: string,
  userEmail: string
): Promise<AcceptResult> {
  const { data, error } = await nidService().rpc("nid_accept_transfer", {
    p_token_hash: hashToken(token),
    p_user_id: userId,
    p_user_email: userEmail,
  });
  if (error) {
    throw new Error(dbErrorMessage(error, "Le transfert n'a pas pu être finalisé."));
  }
  return data as AcceptResult;
}

export async function declineTransfer(
  token: string,
  userId: string,
  userEmail: string
): Promise<void> {
  const service = nidService();
  const { data, error } = await service
    .from("nid_transfers")
    .update({ status: "refuse", buyer_id: userId, responded_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .eq("status", "en_attente")
    .ilike("recipient_email", userEmail)
    .select("id, asset_id");

  if (error) throw new Error(dbErrorMessage(error, "Le refus n'a pas pu être enregistré."));
  const rows = (data ?? []) as { id: string; asset_id: string }[];
  if (rows.length === 0) {
    throw new Error("Cette demande de transfert a déjà été traitée.");
  }

  await service.from("nid_assets").update({ status: "active" }).eq("id", rows[0].asset_id);
  await recordNidAudit({
    actorUserId: userId,
    action: "transfer.declined",
    targetType: "transfer",
    targetId: rows[0].id,
    assetId: rows[0].asset_id,
  });
}

/** Annulation par le vendeur tant que l'acheteur n'a pas répondu. */
export async function cancelTransfer(userId: string, transferId: string): Promise<void> {
  const service = nidService();
  const { data, error } = await service
    .from("nid_transfers")
    .update({ status: "annule", responded_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("seller_id", userId)
    .eq("status", "en_attente")
    .select("id, asset_id");

  if (error) throw new Error(dbErrorMessage(error, "L'annulation a échoué."));
  const rows = (data ?? []) as { id: string; asset_id: string }[];
  if (rows.length === 0) {
    throw new Error("Ce transfert n'est plus en attente.");
  }

  await service
    .from("nid_assets")
    .update({ status: "active" })
    .eq("id", rows[0].asset_id)
    .eq("current_owner_id", userId);

  await recordNidAudit({
    actorUserId: userId,
    action: "transfer.cancelled",
    targetType: "transfer",
    targetId: transferId,
    assetId: rows[0].asset_id,
  });
}
