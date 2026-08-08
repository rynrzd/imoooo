import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  NID_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "../constants";
import { extensionForMime, sanitizeFileName } from "../identifiers";
import { nidService } from "./client";

/**
 * Stockage privé Nireo ID (bucket `nireo-id-private`).
 *
 * Règles appliquées ici, côté serveur :
 *  • chemin toujours généré ({userId}/{assetId}/{groupe}/{uuid}.{ext}) —
 *    le nom fourni par l'utilisateur n'entre jamais dans un chemin ;
 *  • type MIME et taille contrôlés AVANT l'envoi ;
 *  • aucune URL publique : toute lecture passe par une URL signée de
 *    courte durée générée à la demande.
 */

export type UploadGroup = "documents" | "media";

export interface UploadedNidFile {
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface UploadCheck {
  ok: boolean;
  error?: string;
}

/** Vérifie type et taille. Message explicite, jamais technique. */
export function checkUpload(file: File, group: UploadGroup): UploadCheck {
  if (!file || file.size === 0) {
    return { ok: false, error: "Fichier vide ou illisible." };
  }
  const allowed: readonly string[] =
    group === "media" ? ALLOWED_IMAGE_MIME : ALLOWED_DOCUMENT_MIME;
  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      error:
        group === "media"
          ? "Format d'image non pris en charge (JPEG, PNG, WebP ou HEIC attendu)."
          : "Format non pris en charge (PDF, JPEG, PNG, WebP ou HEIC attendu).",
    };
  }
  const max = group === "media" ? MAX_PHOTO_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > max) {
    const mo = Math.round(max / (1024 * 1024));
    return { ok: false, error: `Fichier trop volumineux : ${mo} Mo maximum.` };
  }
  return { ok: true };
}

/**
 * Envoie un fichier dans le dossier de l'utilisateur.
 * `client` porte la session : les policies Storage garantissent qu'un
 * utilisateur n'écrit jamais dans le dossier d'un autre.
 */
export async function uploadNidFile(
  client: SupabaseClient,
  userId: string,
  assetId: string,
  group: UploadGroup,
  file: File
): Promise<UploadedNidFile> {
  const check = checkUpload(file, group);
  if (!check.ok) throw new Error(check.error);

  const extension = extensionForMime(file.type);
  if (!extension) throw new Error("Format de fichier non pris en charge.");

  const path = `${userId}/${assetId}/${group}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(NID_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    logger.error("nireo-id/storage upload", error);
    throw new Error("L'envoi du fichier a échoué. Réessayez dans un instant.");
  }
  return {
    storage_path: path,
    original_name: sanitizeFileName(file.name),
    mime_type: file.type,
    size_bytes: file.size,
  };
}

/** URL signée de courte durée (lecture d'un fichier privé). */
export async function nidSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await nidService()
    .storage.from(NID_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** URL signées en lot — les échecs sont simplement omis (jamais bloquant). */
export async function nidSignedUrlMap(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await nidService()
    .storage.from(NID_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map();
  const entries: [string, string][] = [];
  for (const item of data) {
    if (item.path && item.signedUrl) entries.push([item.path, item.signedUrl]);
  }
  return new Map(entries);
}

/**
 * Supprime des objets du bucket. Utilisé pour annuler proprement des
 * envois lorsqu'une création échoue — jamais bloquant pour l'utilisateur.
 */
export async function removeNidFiles(paths: string[]): Promise<void> {
  const list = paths.filter(Boolean);
  if (list.length === 0) return;
  const { error } = await nidService().storage.from(NID_BUCKET).remove(list);
  if (error) logger.error("nireo-id/storage remove", error);
}
