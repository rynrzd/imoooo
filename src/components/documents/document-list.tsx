"use client";

import * as React from "react";
import { Download, FileText, Trash2 } from "lucide-react";
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
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { DocumentCategory, PropertyDocument } from "@/lib/types";
import { EditDocumentDialog } from "./edit-document-dialog";

interface DocumentListProps {
  documents: PropertyDocument[];
  /** Affiche le nom du logement sur chaque ligne (vue globale). */
  showProperty?: boolean;
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
        className="border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
      >
        Expiré
      </Badge>
    );
  }
  if (document.expiresAt <= soonISO) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
      >
        Expire le {formatDate(document.expiresAt)}
      </Badge>
    );
  }
  return null;
}

const CATEGORY_ORDER: DocumentCategory[] = [
  "bail",
  "etat_des_lieux",
  "assurance",
  "diagnostics",
  "factures",
  "garanties",
  "autres",
];

/** Bibliothèque de documents groupée par catégorie. */
export function DocumentList({ documents, showProperty = false }: DocumentListProps) {
  const { data, isLive, getDocumentUrl, deleteDocument } = useAppStore();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Suppression en deux temps : confirmation explicite.
  const [deleteTarget, setDeleteTarget] = React.useState<PropertyDocument | null>(null);

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

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: documents
      .filter((d) => d.category === category)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  })).filter((group) => group.items.length > 0);

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

      {groups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {DOCUMENT_CATEGORY_LABELS[group.category]}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                {group.items.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <ul className="divide-y divide-border">
              {group.items.map((document) => {
                const property = getProperty(data, document.propertyId);
                return (
                  <li
                    key={document.id}
                    className="flex items-center gap-3 px-2 py-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        <span className="truncate">{document.name}</span>
                        <ExpiryBadge document={document} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          showProperty ? property?.name : null,
                          formatDate(document.addedAt),
                          `${document.fileType.toUpperCase()} · ${document.size}`,
                          document.expiresAt
                            ? `expire le ${formatDate(document.expiresAt)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
