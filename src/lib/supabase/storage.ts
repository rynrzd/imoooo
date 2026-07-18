import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers Supabase Storage (buckets privés).
 * Convention de chemin : {owner_id}/{property_id}/{uuid}.{ext}
 * — les policies Storage n'autorisent que le dossier de l'utilisateur.
 */

export type StorageBucket =
  | "property-documents"
  | "property-photos"
  | "expense-receipts"
  | "profile-avatars"
  | "maintenance-files";

const SIGNED_URL_TTL = 60 * 60; // 1 heure

/** Taille maximale d'un fichier envoyé (20 Mo). */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Extensions acceptées (documents et images gérés par l'application). */
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "docx",
]);

export interface UploadedFile {
  path: string;
  sizeBytes: number;
  ext: string;
}

export async function uploadPrivateFile(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  ownerId: string,
  propertyId: string,
  file: File
): Promise<UploadedFile> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      "Format de fichier non pris en charge. Formats acceptés : PDF, JPG, PNG, WEBP, HEIC, DOCX."
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Fichier trop volumineux : 20 Mo maximum.");
  }
  // Nom de fichier généré (UUID) : aucune entrée utilisateur dans le chemin.
  const path = `${ownerId}/${propertyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
  return { path, sizeBytes: file.size, ext };
}

/** URL signée temporaire pour un fichier privé. */
export async function getSignedUrl(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new Error("Génération du lien sécurisé impossible.");
  }
  return data.signedUrl;
}

/** URL signées en lot — non bloquant : les échecs sont simplement omis. */
export async function createSignedUrlMap(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  paths: string[]
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (error || !data) return new Map();
  const entries: [string, string][] = [];
  for (const entry of data) {
    if (entry.path && entry.signedUrl) entries.push([entry.path, entry.signedUrl]);
  }
  return new Map(entries);
}

export async function removeFile(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Suppression du fichier impossible : ${error.message}`);
}
