"use client";

import * as React from "react";
import { ChevronRight, Download, Eye, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { todayISO } from "@/lib/dates";
import { getProperty } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { groupDocuments, tenantOfDocument } from "@/lib/documents/groups";
import { useAppStore } from "@/lib/store";
import type { PropertyDocument } from "@/lib/types";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { EditDocumentDialog } from "./edit-document-dialog";

interface DocumentListProps {
  documents: PropertyDocument[];
  /** Affiche le nom du logement sur chaque ligne (vue globale). */
  showProperty?: boolean;
  /**
   * Nombre de documents montrés par section avant « Voir tout ».
   * `null` = tout afficher (c'est le cas quand une section est dépliée).
   */
  apercuParSection?: number | null;
}

/** Badge d'état d'expiration d'un document (null si sans objet). */
function ExpiryBadge({ document }: { document: PropertyDocument }) {
  if (!document.expiresAt) return null;
  const today = todayISO();
  const soon = new Date(`${today}T12:00:00`);
  soon.setDate(soon.getDate() + 30);
  const soonISO = soon.toISOString().slice(0, 10);

  if (document.expiresAt < today) {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-danger-soft text-danger"
      >
        Expiré
      </Badge>
    );
  }
  if (document.expiresAt <= soonISO) {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-warning-soft text-warning"
      >
        Expire le {formatDate(document.expiresAt)}
      </Badge>
    );
  }
  return null;
}


/** Bibliothèque de documents groupée par catégorie. */
export function DocumentList({
  documents,
  showProperty = false,
  apercuParSection = null,
}: DocumentListProps) {
  const { data, isLive, getDocumentUrl, deleteDocument } = useAppStore();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Suppression en deux temps : confirmation explicite.
  const [deleteTarget, setDeleteTarget] = React.useState<PropertyDocument | null>(null);
  // Aperçu dans l'application, plutôt qu'une URL signée brute dans un onglet.
  const [previewTarget, setPreviewTarget] = React.useState<PropertyDocument | null>(null);
  // Sections dépliées manuellement (« Voir tout »).
  const [deplie, setDeplie] = React.useState<Record<string, boolean>>({});

  const handleDownload = async (document: PropertyDocument) => {
    if (!isLive || !document.filePath) {
      toast.info(
        isLive
          ? "Aucun fichier associé à ce document."
          : "Mode démo : le stockage de fichiers est actif une fois Supabase configuré."
      );
      return;
    }
    setBusyId(document.id);
    try {
      const url = await getDocumentUrl(document);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (document: PropertyDocument) => {
    setBusyId(document.id);
    try {
      await deleteDocument(document.id);
      toast.success("Document supprimé.");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusyId(null);
    }
  };

  // Cinq sections utiles plutôt que sept catégories : voir lib/documents/groups.
  const groups = groupDocuments(documents).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Confirmation de suppression */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer ce document ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.name} » sera définitivement supprimé
              {deleteTarget?.filePath ? ", ainsi que son fichier" : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteTarget !== null && busyId === deleteTarget.id}
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
              }}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aperçu du document, dans l'application. */}
      <DocumentPreviewDialog
        document={previewTarget}
        open={previewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      />

      {groups.map(({ group, items }) => {
        // Une section montre ses documents les plus récents, puis propose de
        // voir le reste : cinq sections entières feraient une page qu'on
        // parcourt au lieu d'une page qu'on lit.
        const limite = deplie[group.id] || apercuParSection === null ? items.length : apercuParSection;
        const visibles = items.slice(0, limite);
        const reste = items.length - visibles.length;

        return (
          <Card key={group.id}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                {group.label}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                  {items.length}
                </span>
              </CardTitle>
              {reste > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-2 h-8 text-xs"
                  onClick={() => setDeplie((prev) => ({ ...prev, [group.id]: true }))}
                >
                  Voir tout
                  <ChevronRight className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="px-3">
              <ul className="divide-y divide-border">
                {visibles.map((document) => {
                  const property = getProperty(data, document.propertyId);
                  const locataire = tenantOfDocument(data, document);
                  return (
                    <li key={document.id} className="flex items-center gap-3 px-2 py-2.5">
                      {/* Le nom ouvre l'aperçu : c'est le geste attendu, et il
                          reste un vrai bouton pour le clavier. */}
                      <button
                        type="button"
                        onClick={() => setPreviewTarget(document)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileText className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                            <span className="truncate">{document.name}</span>
                            <ExpiryBadge document={document} />
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[
                              showProperty ? property?.name : null,
                              locataire,
                              formatDate(document.addedAt),
                              `${document.fileType.toUpperCase()} · ${document.size}`,
                              document.expiresAt
                                ? `expire le ${formatDate(document.expiresAt)}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Aperçu de ${document.name}`}
                        onClick={() => setPreviewTarget(document)}
                        className="max-sm:hidden"
                      >
                        <Eye />
                      </Button>
                      <EditDocumentDialog document={document} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Télécharger ${document.name}`}
                        disabled={busyId === document.id}
                        onClick={() => void handleDownload(document)}
                      >
                        <Download />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer ${document.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busyId === document.id}
                        onClick={() => setDeleteTarget(document)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {reste > 0 ? (
                <p className="px-2 pt-2 text-xs text-muted-foreground">
                  {reste} document{reste > 1 ? "s" : ""} de plus dans cette section.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
