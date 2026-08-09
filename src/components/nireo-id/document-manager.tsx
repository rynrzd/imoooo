"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  addDocumentAction,
  deleteDocumentAction,
  documentUrlAction,
  updateDocumentPolicyAction,
} from "@/features/nireo-id/actions/owner";
import {
  ALLOWED_DOCUMENT_MIME,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  MAX_DOCUMENT_BYTES,
  TRANSFER_POLICIES,
  TRANSFER_POLICY_LABELS,
  type DocumentKind,
  type TransferPolicy,
} from "@/features/nireo-id/constants";
import { formatFileSize, formatShortDate } from "@/features/nireo-id/format";
import type { DocumentRow } from "@/features/nireo-id/types";

/**
 * Documents privés d'un téléphone : ajout réel (bucket privé), politique
 * de transfert par document, ouverture par URL signée de courte durée,
 * suppression. Aucun lien public n'est jamais produit.
 */
export function DocumentManager({
  assetId,
  documents,
  canEdit,
}: {
  assetId: string;
  documents: DocumentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [kind, setKind] = React.useState<DocumentKind>("facture");
  const [policy, setPolicy] = React.useState<TransferPolicy>("prive");
  const [pending, setPending] = React.useState(false);
  const [openingId, setOpeningId] = React.useState<string | null>(null);

  const upload = async () => {
    if (!file || pending) return;
    if (!(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(file.type)) {
      toast.error("Format non pris en charge (PDF, JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`Fichier trop volumineux : ${formatFileSize(MAX_DOCUMENT_BYTES)} maximum.`);
      return;
    }
    setPending(true);
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("kind", kind);
    form.set("transfer_policy", policy);
    form.set("document", file);
    const result = await addDocumentAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Document ajouté au dossier privé.");
    setFile(null);
    router.refresh();
  };

  const open = async (documentId: string) => {
    setOpeningId(documentId);
    const result = await documentUrlAction(documentId);
    setOpeningId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  };

  const changePolicy = async (documentId: string, value: TransferPolicy) => {
    const form = new FormData();
    form.set("document_id", documentId);
    form.set("transfer_policy", value);
    form.set("asset_id", assetId);
    const result = await updateDocumentPolicyAction(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Politique de transfert mise à jour.");
    router.refresh();
  };

  const remove = async (documentId: string, name: string) => {
    if (!window.confirm(`Supprimer définitivement « ${name} » ? Cette action est irréversible.`)) {
      return;
    }
    const form = new FormData();
    form.set("document_id", documentId);
    form.set("asset_id", assetId);
    const result = await deleteDocumentAction(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Document supprimé.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {documents.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Aucun document dans ce dossier. Ajoutez la facture d’achat : elle
          reste privée et vous choisirez plus tard si elle suit l’appareil.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((document) => (
            <li key={document.id} className="nid-panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {document.original_name || DOCUMENT_KIND_LABELS[document.kind]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_KIND_LABELS[document.kind]} · {formatFileSize(document.size_bytes)}{" "}
                      · Ajouté le {formatShortDate(document.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => open(document.id)}
                    disabled={openingId === document.id}
                    aria-label={`Ouvrir ${document.original_name || "le document"}`}
                  >
                    {openingId === document.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="size-3.5" />
                    )}
                  </Button>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(document.id, document.original_name || "ce document")}
                      aria-label={`Supprimer ${document.original_name || "le document"}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>

              {canEdit ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Label htmlFor={`policy-${document.id}`} className="text-xs text-muted-foreground">
                    En cas de vente
                  </Label>
                  <select
                    id={`policy-${document.id}`}
                    value={document.transfer_policy}
                    onChange={(event) =>
                      changePolicy(document.id, event.target.value as TransferPolicy)
                    }
                    className="rounded-lg border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {TRANSFER_POLICIES.map((value) => (
                      <option key={value} value={value}>
                        {TRANSFER_POLICY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="nid-panel space-y-3 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground">Ajouter un document</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="document-kind">Type</Label>
              <select
                id="document-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as DocumentKind)}
                className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {DOCUMENT_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {DOCUMENT_KIND_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-policy">En cas de vente</Label>
              <select
                id="document-policy"
                value={policy}
                onChange={(event) => setPolicy(event.target.value as TransferPolicy)}
                className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {TRANSFER_POLICIES.map((value) => (
                  <option key={value} value={value}>
                    {TRANSFER_POLICY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document-file">Fichier</Label>
            <input
              id="document-file"
              type="file"
              accept={ALLOWED_DOCUMENT_MIME.join(",")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-xl border border-dashed border-border bg-transparent px-3 py-3 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              PDF ou image, {formatFileSize(MAX_DOCUMENT_BYTES)} maximum. Stockage
              privé, lecture par lien signé de courte durée.
            </p>
          </div>

          <Button data-touch onClick={upload} disabled={!file || pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Envoi…
              </>
            ) : (
              <>
                <Upload className="size-4" data-icon="inline-start" />
                Ajouter le document
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
