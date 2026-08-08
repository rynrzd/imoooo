import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/supabase/config";
import { createToken, hashToken } from "../identifiers";
import type { createShareSchema } from "../schemas";
import type { z } from "zod";
import type { PublicPreview, ShareResolution } from "../types";
import { dbErrorMessage, isNireoIdConfigured, nidService, nidUserClient } from "./client";
import { recordNidAudit } from "./audit";

/**
 * Partage contrôlé d'un passeport.
 *
 * Deux surfaces publiques, volontairement différentes :
 *  • l'APERÇU PUBLIC (/id/p/<identifiant>) : permanent, minimal, ne montre
 *    que ce que le propriétaire a explicitement autorisé ;
 *  • le DOSSIER PARTAGÉ (/id/s/<jeton>) : temporaire, révocable, limité aux
 *    sections choisies.
 *
 * Le jeton n'est jamais stocké : seule son empreinte SHA-256 est en base.
 */

type CreateShareInput = z.infer<typeof createShareSchema>;

export interface CreatedShare {
  id: string;
  url: string;
  expires_at: string;
}

export function shareUrl(token: string): string {
  return `${SITE_URL}/id/s/${token}`;
}

export function publicUrl(publicId: string): string {
  return `${SITE_URL}/id/p/${publicId}`;
}

/** Crée un lien de partage. Le jeton brut n'est retourné qu'ici, une fois. */
export async function createShare(
  userId: string,
  input: CreateShareInput
): Promise<CreatedShare> {
  const supabase = await nidUserClient();
  const token = createToken();
  const expiresAt = new Date(Date.now() + input.duration_hours * 3600 * 1000);

  // Les documents partagés doivent appartenir au passeport concerné :
  // la liste envoyée par le navigateur n'est jamais reprise telle quelle.
  let documentIds: string[] = [];
  if (input.sections.includes("documents") && input.document_ids.length > 0) {
    const { data } = await supabase
      .from("nid_documents")
      .select("id")
      .eq("asset_id", input.asset_id)
      .eq("status", "actif")
      .in("id", input.document_ids);
    documentIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
  }

  const { data, error } = await supabase
    .from("nid_share_links")
    .insert({
      asset_id: input.asset_id,
      created_by: userId,
      token_hash: hashToken(token),
      label: input.label ?? "",
      sections: input.sections,
      document_ids: documentIds,
      allow_download: input.allow_download,
      show_serial_last4: input.show_serial_last4,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, expires_at")
    .single();

  if (error || !data) {
    throw new Error(dbErrorMessage(error, "La création du lien de partage a échoué."));
  }

  await recordNidAudit({
    actorUserId: userId,
    action: "share.created",
    targetType: "share_link",
    targetId: data.id as string,
    assetId: input.asset_id,
    metadata: { sections: input.sections, duration_hours: input.duration_hours },
  });

  return { id: data.id as string, url: shareUrl(token), expires_at: data.expires_at as string };
}

/** Révocation immédiate : le lien cesse de fonctionner dès l'appel suivant. */
export async function revokeShare(userId: string, shareId: string): Promise<void> {
  const supabase = await nidUserClient();
  const { data, error } = await supabase
    .from("nid_share_links")
    .update({ revoked_at: new Date().toISOString(), revoked_by: userId })
    .eq("id", shareId)
    .is("revoked_at", null)
    .select("id, asset_id");

  if (error) throw new Error(dbErrorMessage(error, "La révocation a échoué."));
  const rows = (data ?? []) as { id: string; asset_id: string }[];
  if (rows.length === 0) {
    throw new Error("Ce lien n'existe plus ou a déjà été révoqué.");
  }

  await recordNidAudit({
    actorUserId: userId,
    action: "share.revoked",
    targetType: "share_link",
    targetId: shareId,
    assetId: rows[0].asset_id,
  });
}

/** Résout un jeton de partage (états : valide, expiré, révoqué, introuvable). */
export async function resolveShare(token: string): Promise<ShareResolution> {
  if (!isNireoIdConfigured) return { state: "introuvable" };
  if (!token || token.length < 20 || token.length > 100) return { state: "introuvable" };

  const { data, error } = await nidService().rpc("nid_resolve_share", {
    p_token_hash: hashToken(token),
  });
  if (error) {
    logger.error("nireo-id/share resolve", error);
    return { state: "introuvable" };
  }
  return (data as ShareResolution) ?? { state: "introuvable" };
}

/* ------------------------------------------------------------------ */
/*  Aperçu public                                                      */
/* ------------------------------------------------------------------ */

/**
 * Aperçu public minimal. La fonction SQL ne renvoie que des champs
 * explicitement listés : aucun nom, aucune adresse, aucun IMEI complet,
 * aucun document, aucun historique d'accès ne peut en sortir.
 */
export async function getPublicPreview(publicId: string): Promise<PublicPreview | null> {
  if (!isNireoIdConfigured) return null;
  const { data, error } = await nidService().rpc("nid_public_preview", {
    p_public_id: publicId,
  });
  if (error) {
    logger.error("nireo-id/public preview", error);
    return null;
  }
  return (data as PublicPreview | null) ?? null;
}

/** Résout un identifiant public vers l'UUID interne (recherche/scanner). */
export async function findAssetIdByPublicId(publicId: string): Promise<string | null> {
  if (!isNireoIdConfigured) return null;
  const { data } = await nidService()
    .from("nid_assets")
    .select("id")
    .eq("public_id", publicId.trim().toUpperCase())
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
