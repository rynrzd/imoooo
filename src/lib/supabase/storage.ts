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

/* ------------------------------------------------------------------ */
/*  Ce qu'un bucket accepte                                            */
/* ------------------------------------------------------------------ */

/**
 * Familles de fichiers reconnues à leurs OCTETS, jamais à leur nom.
 * `zip` est le conteneur d'un .docx (un document Word est une archive ZIP).
 */
type FileKind = "pdf" | "jpeg" | "png" | "webp" | "heic" | "zip";

/** Type MIME déclaré à Storage pour chaque famille réellement constatée. */
const MIME_FOR_KIND: Record<FileKind, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  zip: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const IMAGE_KINDS: readonly FileKind[] = ["jpeg", "png", "webp", "heic"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic"];

interface BucketPolicy {
  maxBytes: number;
  kinds: readonly FileKind[];
  extensions: readonly string[];
  /** Formats énoncés à l'utilisateur — repris tels quels dans les messages. */
  label: string;
}

/**
 * Règles par bucket — le miroir EXACT de la migration
 * 20260819100000_storage_upload_limits.sql, qui les applique côté serveur.
 *
 * Ces règles-ci ne protègent rien : le code qui les exécute tourne dans le
 * navigateur (`src/lib/store.tsx` est un composant client), donc quelqu'un de
 * déterminé les contourne en appelant l'API Storage directement. Elles
 * servent à donner une ERREUR CLAIRE et immédiate, en français, avant de
 * téléverser inutilement 20 Mo. La limite qui fait foi est celle du bucket.
 *
 * Elles reprennent l'attribut `accept` déjà posé sur chaque champ de
 * fichier : un avatar n'a jamais accepté de PDF, une photo de logement
 * jamais de DOCX. Rien de ce qui marchait ne cesse de marcher.
 */
const BUCKET_POLICIES: Record<StorageBucket, BucketPolicy> = {
  "property-documents": {
    maxBytes: 20 * 1024 * 1024,
    kinds: ["pdf", ...IMAGE_KINDS, "zip"],
    extensions: ["pdf", ...IMAGE_EXTENSIONS, "docx"],
    label: "PDF, JPG, PNG, WEBP, HEIC, DOCX",
  },
  "expense-receipts": {
    maxBytes: 20 * 1024 * 1024,
    kinds: ["pdf", ...IMAGE_KINDS, "zip"],
    extensions: ["pdf", ...IMAGE_EXTENSIONS, "docx"],
    label: "PDF, JPG, PNG, WEBP, HEIC, DOCX",
  },
  "maintenance-files": {
    maxBytes: 20 * 1024 * 1024,
    kinds: ["pdf", ...IMAGE_KINDS, "zip"],
    extensions: ["pdf", ...IMAGE_EXTENSIONS, "docx"],
    label: "PDF, JPG, PNG, WEBP, HEIC, DOCX",
  },
  "property-photos": {
    maxBytes: 10 * 1024 * 1024,
    kinds: IMAGE_KINDS,
    extensions: IMAGE_EXTENSIONS,
    label: "JPG, PNG, WEBP, HEIC",
  },
  "profile-avatars": {
    maxBytes: 5 * 1024 * 1024,
    kinds: IMAGE_KINDS,
    extensions: IMAGE_EXTENSIONS,
    label: "JPG, PNG, WEBP, HEIC",
  },
};

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/**
 * Famille réelle d'un fichier, lue dans ses premiers octets (« nombre
 * magique »). Retourne null si la signature n'est reconnue d'aucune des
 * familles gérées par Nireo — ce qui écarte les exécutables, les scripts,
 * le HTML et les SVG, qu'une simple extension laissait passer.
 *
 * Renommer `virus.exe` en `photo.jpg` ne suffit donc plus.
 */
async function detectFileKind(file: File): Promise<FileKind | null> {
  // 16 octets suffisent : la plus longue signature gérée (HEIC) tient dans 12.
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (header.length < 4) return null;

  const startsWith = (...bytes: number[]): boolean =>
    bytes.every((b, i) => header[i] === b);
  const ascii = (offset: number, length: number): string =>
    String.fromCharCode(...header.slice(offset, offset + length));

  if (startsWith(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (startsWith(0xff, 0xd8, 0xff)) return "jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  // RIFF....WEBP : la taille occupe les octets 4 à 8.
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  // Conteneur ISO-BMFF : « ftyp » en position 4, puis la marque du format.
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    const HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"];
    return HEIC_BRANDS.includes(brand) ? "heic" : null;
  }
  // Archive ZIP — le conteneur d'un .docx. « PK\x03\x04 ».
  if (startsWith(0x50, 0x4b, 0x03, 0x04)) return "zip";
  return null;
}

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
  const policy = BUCKET_POLICIES[bucket];

  if (file.size === 0) {
    throw new Error("Ce fichier est vide : rien à envoyer.");
  }
  if (file.size > policy.maxBytes) {
    throw new Error(`Fichier trop volumineux : ${megabytes(policy.maxBytes)} Mo maximum.`);
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!policy.extensions.includes(ext)) {
    throw new Error(`Format de fichier non pris en charge. Formats acceptés : ${policy.label}.`);
  }

  // Le CONTENU doit correspondre à un format géré — l'extension ne prouve rien.
  const kind = await detectFileKind(file);
  if (!kind || !policy.kinds.includes(kind)) {
    throw new Error(
      `Ce fichier ne correspond pas à son extension, ou son format n'est pas pris en charge. Formats acceptés : ${policy.label}.`
    );
  }
  // Une archive ZIP n'est acceptée que présentée comme un document Word :
  // sans cette règle, n'importe quelle archive passerait sous le nom .docx.
  if (kind === "zip" && ext !== "docx") {
    throw new Error(`Format de fichier non pris en charge. Formats acceptés : ${policy.label}.`);
  }

  const mime = MIME_FOR_KIND[kind];

  /*
   * Le type est porté par le FICHIER, pas par les options.
   *
   * Quand on lui donne un Blob ou un File, `@supabase/storage-js` construit
   * un `FormData` et y ajoute le fichier tel quel — l'option `contentType`
   * n'est alors JAMAIS lue (elle ne sert que pour un corps brut :
   * ArrayBuffer, chaîne, flux). Le type que Storage reçoit est donc celui
   * que porte l'objet `File` lui-même.
   *
   * Or c'est précisément ce champ qui n'est pas fiable : Safari et Chrome le
   * laissent vide pour un HEIC d'iPhone, et le serveur voit alors
   * « application/octet-stream » — refusé par la liste du bucket. Passer par
   * l'option aurait donc échoué en silence sur le cas même qu'elle devait
   * couvrir.
   *
   * `slice` ne recopie aucune donnée : il renvoie une vue typée sur le même
   * contenu, quel que soit le poids du fichier.
   */
  const body = file.type === mime ? file : file.slice(0, file.size, mime);

  // Nom de fichier généré (UUID) : aucune entrée utilisateur dans le chemin.
  const path = `${ownerId}/${propertyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    upsert: false,
    // Conservé pour les corps bruts et pour dire l'intention ; le type qui
    // fait foi côté serveur est celui de `body` ci-dessus.
    contentType: mime,
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
