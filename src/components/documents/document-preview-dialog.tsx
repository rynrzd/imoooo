"use client";

import * as React from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getProperty } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/labels";
import { tenantOfDocument } from "@/lib/documents/groups";
import { useAppStore } from "@/lib/store";
import type { PropertyDocument } from "@/lib/types";

/**
 * Aperçu d'un document.
 *
 * POURQUOI PAS UN SIMPLE `window.open`
 * ------------------------------------
 * Ouvrir l'URL signée dans un onglet marchait, mais sortait l'utilisateur de
 * Nireo : il se retrouvait devant une adresse Supabase interminable, sans le
 * nom du document, sans le logement, sans le locataire, et sans moyen de
 * revenir autrement qu'en fermant l'onglet. Le contexte — de quel bien, de
 * quel bail, de quelle période parle ce PDF — est précisément ce qu'on
 * cherche quand on ouvre un document.
 *
 * L'aperçu reste donc DANS l'application : les informations à gauche, le
 * document à droite. Le téléchargement et l'ouverture en plein écran restent
 * accessibles d'un clic pour qui les veut.
 *
 * CE QUI EST RÉELLEMENT AFFICHABLE
 * --------------------------------
 * Les PDF et les images le sont, dans un `<object>` : contrairement à une
 * `<iframe>`, il expose un contenu de repli quand le format n'est pas rendu
 * par le navigateur. Un DOCX ne s'affiche nulle part sans convertisseur —
 * on ne fait donc pas semblant : on propose le téléchargement.
 *
 * L'URL signée est demandée à l'OUVERTURE et jamais avant : elle expire, et
 * en pré-charger une par ligne de liste ferait autant d'appels inutiles.
 */

const APERÇU_POSSIBLE = ["pdf", "jpg", "png"] as const;

export function DocumentPreviewDialog({
  document,
  open,
  onOpenChange,
}: {
  document: PropertyDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLive, getDocumentUrl } = useAppStore();
  /**
   * Le lien est mémorisé AVEC l'identifiant du document auquel il appartient.
   *
   * Un simple `url` aurait obligé à le remettre à zéro dans l'effet — donc à
   * poser un état pendant un effet, ce que la règle `set-state-in-effect`
   * interdit ici, et pour une bonne raison : cela provoque un second rendu
   * systématique. En rattachant le lien à son document, l'état d'attente et
   * l'URL affichée se DÉDUISENT, sans aucune écriture synchrone.
   */
  const [lien, setLien] = React.useState<{ id: string; url: string | null } | null>(null);

  const affichable =
    document !== null &&
    Boolean(document.filePath) &&
    (APERÇU_POSSIBLE as readonly string[]).includes(document.fileType);

  const lienDuDocument = document && lien?.id === document.id ? lien : null;
  const url = lienDuDocument?.url ?? null;
  // « On devrait avoir un lien et on ne l'a pas encore » = chargement.
  const busy = open && affichable && isLive && lienDuDocument === null;

  React.useEffect(() => {
    if (!open || !document || !affichable || !isLive) return;
    if (lien?.id === document.id) return; // déjà demandé pour ce document
    let annulé = false;
    void getDocumentUrl(document)
      .then((adresse) => {
        if (!annulé) setLien({ id: document.id, url: adresse ?? null });
      })
      .catch(() => {
        if (!annulé) setLien({ id: document.id, url: null });
      });
    return () => {
      annulé = true;
    };
  }, [open, document, affichable, isLive, getDocumentUrl, lien]);

  if (!document) return null;

  const property = getProperty(data, document.propertyId);
  const locataire = tenantOfDocument(data, document);

  const telecharger = async () => {
    if (!isLive || !document.filePath) {
      toast.info(
        isLive
          ? "Aucun fichier associé à ce document."
          : "Mode démo : le stockage de fichiers est actif une fois Supabase configuré."
      );
      return;
    }
    try {
      const lien = await getDocumentUrl(document);
      if (lien) window.open(lien, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    }
  };

  const infos: { label: string; value: string }[] = [
    { label: "Catégorie", value: DOCUMENT_CATEGORY_LABELS[document.category] },
    { label: "Logement", value: property?.name ?? "—" },
    ...(locataire ? [{ label: "Locataire", value: locataire }] : []),
    { label: "Ajouté le", value: formatDate(document.addedAt) },
    { label: "Fichier", value: `${document.fileType.toUpperCase()} · ${document.size}` },
    ...(document.expiresAt
      ? [{ label: "Expire le", value: formatDate(document.expiresAt) }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">{document.name}</DialogTitle>
          <DialogDescription>
            {[property?.name, locataire].filter(Boolean).join(" · ") ||
              "Document de votre bibliothèque privée"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          {/* Le document lui-même. Sur mobile il passe en premier et garde
              une hauteur lisible sans manger tout l'écran. */}
          <div className="order-1 min-h-[16rem] overflow-hidden rounded-xl border border-border bg-muted/40 sm:order-none sm:min-h-[26rem]">
            {busy ? (
              <div className="flex h-full min-h-[16rem] items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
              </div>
            ) : url ? (
              <object
                data={url}
                type={document.fileType === "pdf" ? "application/pdf" : undefined}
                className="h-[16rem] w-full sm:h-[26rem]"
                aria-label={`Aperçu de ${document.name}`}
              >
                {/* Repli : le navigateur ne sait pas afficher ce format. */}
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <FileText className="size-8 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Ce document ne peut pas être affiché ici.
                  </p>
                  <Button type="button" variant="outline" onClick={() => void telecharger()}>
                    <Download className="size-4" aria-hidden />
                    Télécharger
                  </Button>
                </div>
              </object>
            ) : (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {document.filePath
                    ? affichable
                      ? "Aperçu indisponible pour le moment."
                      : "Ce format ne s’affiche pas dans le navigateur."
                    : "Aucun fichier n’est associé à ce document."}
                </p>
                {document.filePath ? (
                  <Button type="button" variant="outline" onClick={() => void telecharger()}>
                    <Download className="size-4" aria-hidden />
                    Télécharger
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <div className="order-2 sm:order-none">
            <dl className="space-y-3">
              {infos.map((info) => (
                <div key={info.label}>
                  <dt className="text-xs text-muted-foreground">{info.label}</dt>
                  <dd className="text-sm font-medium break-words text-foreground">
                    {info.value}
                  </dd>
                </div>
              ))}
            </dl>

            {document.filePath ? (
              <div className="mt-5 flex flex-col gap-2">
                <Button type="button" onClick={() => void telecharger()}>
                  <Download className="size-4" aria-hidden />
                  Télécharger
                </Button>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Ouvrir en plein écran
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
