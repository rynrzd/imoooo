"use client";

import * as React from "react";
import { Film, Loader2, Trash2, UploadCloud, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  commitCompanyVideo,
  createCompanyVideoUploadUrl,
  deleteCompanyVideo,
} from "@/lib/admin/actions/company";
import type { CompanyVideo } from "@/lib/admin/company";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

/* --------------------------- Constantes UI -------------------------- */

const MAX_BYTES = 200 * 1024 * 1024; // 200 Mo
const ACCEPT = "video/mp4,video/quicktime,video/webm";
const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const ALLOWED_EXT = new Set(["mp4", "mov", "webm"]);

function formatBytes(n: number): string {
  if (!n) return "0 o";
  const mo = n / (1024 * 1024);
  if (mo >= 1) return `${mo.toFixed(mo >= 10 ? 0 : 1)} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
}

function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

/** Valide le fichier côté client (messages exacts demandés). */
function validate(file: File): string | null {
  const okType = ALLOWED_MIME.has(file.type) || ALLOWED_EXT.has(extOf(file.name));
  if (!okType) return "Format non pris en charge. Utilisez un fichier MP4, MOV ou WebM.";
  if (file.size > MAX_BYTES) return "La vidéo est trop volumineuse. Taille maximale autorisée : 200 Mo.";
  return null;
}

/**
 * Téléverse directement le fichier vers l'URL signée (navigateur → Supabase),
 * avec barre de progression réelle (XHR). Reproduit la requête de supabase-js
 * pour `uploadToSignedUrl` : PUT multipart, champs `cacheControl` + fichier.
 */
function putToSignedUrl(
  signedUrl: string,
  file: File,
  apikey: string,
  onProgress: (ratio: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "true");
    if (apikey) {
      xhr.setRequestHeader("apikey", apikey);
      xhr.setRequestHeader("authorization", `Bearer ${apikey}`);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Téléversement refusé (HTTP ${xhr.status}). ${xhr.responseText || ""}`.trim()));
    xhr.onerror = () => reject(new Error("Erreur réseau pendant le téléversement."));
    xhr.onabort = () => reject(new Error("Téléversement annulé."));
    xhr.send(form);
  });
}

/* ------------------------------ Composant --------------------------- */

export function CompanyVideoManager({
  value,
  onChange,
}: {
  value: CompanyVideo | null;
  onChange: (v: CompanyVideo | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "upload" | "delete">(null);
  const [progress, setProgress] = React.useState(0);

  // Nettoie l'URL objet locale.
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pick = () => inputRef.current?.click();

  const selectFile = (f: File | undefined | null) => {
    if (!f) return;
    const err = validate(f);
    if (err) {
      toast.error(err);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setProgress(0);
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const publish = async () => {
    if (!file || busy) return;
    setBusy("upload");
    setProgress(0);
    try {
      // 1) URL signée (serveur, admin-gated).
      const signed = await createCompanyVideoUploadUrl({
        fileName: file.name,
        contentType: file.type || `video/${extOf(file.name)}`,
        size: file.size,
      });
      if (!signed.ok) {
        toast.error(signed.error);
        return;
      }
      // 2) Upload direct navigateur → Supabase (progression réelle en XHR).
      //    Repli sur le SDK officiel `uploadToSignedUrl` si le XHR échoue.
      let apikey = "";
      try {
        apikey = getSupabaseEnv().publishableKey;
      } catch {
        /* la clé publishable n'est pas requise si l'URL signée suffit */
      }
      try {
        await putToSignedUrl(signed.signedUrl, file, apikey, setProgress);
      } catch (xhrErr) {
        // Repli fiable (sans progression fine) via supabase-js.
        setProgress(0.5);
        const { error: upErr } = await createClient()
          .storage.from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type || undefined,
            upsert: true,
          });
        if (upErr) throw xhrErr instanceof Error ? xhrErr : new Error(upErr.message);
      }
      setProgress(1);
      // 3) Publication (serveur : URL publique + écriture + purge ancienne + cache).
      const committed = await commitCompanyVideo({
        path: signed.path,
        fileName: file.name,
        size: file.size,
      });
      if (!committed.ok) {
        toast.error(committed.error);
        return;
      }
      onChange(committed.video);
      clearSelection();
      toast.success(committed.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléversement impossible.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy("delete");
    try {
      const res = await deleteCompanyVideo();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(null);
      clearSelection();
      toast.success(res.message ?? "Vidéo supprimée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusy(null);
    }
  };

  const uploading = busy === "upload";
  const pct = Math.round(progress * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Film className="size-4 text-primary" /> Vidéo de présentation
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV ou WebM · 200 Mo max. Téléversée dans Supabase Storage, affichée sur la vitrine.
          </p>
        </div>
        {value ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Vidéo publiée
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Aucune vidéo
          </span>
        )}
      </div>

      {/* Input fichier (galerie/fichiers du téléphone ou de l'ordinateur). */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => selectFile(e.target.files?.[0])}
      />

      {/* --- Fichier sélectionné (non encore publié) --- */}
      {file ? (
        <div className="mt-4 space-y-3">
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            {previewUrl ? (
              <video src={previewUrl} controls playsInline preload="metadata" className="max-h-72 w-full object-contain" />
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
          </div>

          {uploading ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Téléversement… {pct}%</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={publish} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              {uploading ? "Publication…" : "Enregistrer et publier"}
            </Button>
            <Button variant="outline" onClick={clearSelection} disabled={uploading}>
              <X className="size-4" /> Annuler
            </Button>
          </div>
        </div>
      ) : value ? (
        /* --- Vidéo actuellement publiée --- */
        <div className="mt-4 space-y-3">
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            <video
              src={value.url}
              controls
              playsInline
              preload="metadata"
              className="max-h-72 w-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {value.fileName || value.path}
            </span>
            {value.size ? <span className="shrink-0 text-muted-foreground">{formatBytes(value.size)}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={pick} disabled={busy !== null}>
              <Video className="size-4" /> Remplacer la vidéo
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Supprimer la vidéo
            </Button>
          </div>
        </div>
      ) : (
        /* --- Zone de dépôt (aucune vidéo) --- */
        <button
          type="button"
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            selectFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors",
            dragOver ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-primary/40 hover:bg-muted"
          )}
        >
          <span className="grid size-11 place-items-center rounded-full bg-primary/12 text-primary">
            <UploadCloud className="size-5" />
          </span>
          <span className="text-sm font-medium text-foreground">Choisir une vidéo</span>
          <span className="text-xs text-muted-foreground">
            Depuis la galerie / les fichiers, ou glissez-déposez ici · MP4, MOV, WebM · 200 Mo max
          </span>
        </button>
      )}
    </div>
  );
}
