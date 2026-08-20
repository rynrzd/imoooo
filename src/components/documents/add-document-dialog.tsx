"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/components/form/errors";
import {
  DateField,
  FileField,
  MoreDetails,
  SelectField,
  TextField,
} from "@/components/form/fields";
import { SheetForm } from "@/components/form/sheet-form";
import { SubmitButton } from "@/components/form/submit-button";
import { DOCUMENT_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { guessCategory } from "@/lib/documents/groups";
import { useAppStore } from "@/lib/store";
import type { DocumentCategory } from "@/lib/types";

/**
 * AJOUT D'UN DOCUMENT — dans l'ordre où l'on pense.
 *
 *   1. le logement concerné   4. le nom du document
 *   2. le fichier             5. l'échéance, si elle a un sens
 *   3. la catégorie
 *
 * Le fichier vient AVANT le nom parce qu'il le pré-remplit : demander le nom
 * d'abord obligeait à le saisir, puis à le corriger. Les catégories sont celles
 * de la base (`DOCUMENT_CATEGORY_LABELS`), aucune n'a été ajoutée ni retirée.
 *
 * Le fichier part réellement dans le bucket privé `property-documents`, sous
 * `{owner}/{logement}/{uuid}.{ext}`, et n'est relu que par URL signée.
 */

interface AddDocumentDialogProps {
  /** Pré-sélectionne et verrouille le logement (fiche logement). */
  propertyId?: string;
  /** Fichier déjà choisi (glisser-déposer depuis la bibliothèque). */
  droppedFile?: File | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

/** Catégories pour lesquelles une date d'échéance a un sens réel. */
const EXPIRING: DocumentCategory[] = ["assurance", "diagnostics", "garanties"];

export function AddDocumentDialog({
  propertyId,
  droppedFile = null,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddDocumentDialogProps) {
  const { data, addDocument, isLive } = useAppStore();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [target, setTarget] = React.useState(propertyId ?? "");
  const [file, setFile] = React.useState<File | null>(droppedFile);
  const [category, setCategory] = React.useState<DocumentCategory>("autres");
  // Une catégorie devinée ne doit JAMAIS écraser un choix explicite : dès que
  // l'utilisateur touche à la liste, la déduction automatique se tait.
  const [categoryChoisie, setCategoryChoisie] = React.useState(false);
  // Ce qui a été deviné, pour pouvoir le DIRE plutôt que de le faire en
  // douce : un classement invisible est un classement qu'on ne corrige pas.
  const [devinee, setDevinee] = React.useState<DocumentCategory | null>(null);
  const [name, setName] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);

  // Chaque ouverture repart d'un état propre. Différé d'un tick : aucun
  // setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setTarget(
        propertyId ??
          (data.properties.length === 1 ? data.properties[0].id : "")
      );
      setFile(droppedFile);
      setCategory("autres");
      setName(droppedFile ? droppedFile.name.replace(/\.[^.]+$/, "") : "");
      setExpiresAt("");
      setErrors({});
      setProgress(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, propertyId, droppedFile, data.properties]);

  const submit = async () => {
    if (busy) return;
    const next: Record<string, string> = {};
    if (!target) next.target = "Choisissez le logement concerné.";
    if (name.trim().length < 2) next.name = "Donnez un nom à ce document.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    if (file) setProgress(8);
    const ticker = file
      ? window.setInterval(() => {
          setProgress((p) => (p === null ? null : Math.min(90, p + 7)));
        }, 220)
      : null;
    try {
      await addDocument(
        {
          propertyId: target,
          name: name.trim(),
          category,
          // Uniquement pour les catégories qui expirent réellement.
          expiresAt: EXPIRING.includes(category) ? expiresAt || null : null,
        },
        file ?? undefined
      );
      if (file) setProgress(100);
      toast.success(
        file ? "Document importé." : "Document ajouté à la bibliothèque."
      );
      setOpen(false);
    } catch (e) {
      // L'import a échoué : le fichier choisi RESTE sélectionné, l'utilisateur
      // n'a qu'à réessayer sans tout ressaisir.
      toast.error(toUserMessage(e, "Ajout impossible."));
      setProgress(null);
    } finally {
      if (ticker) window.clearInterval(ticker);
      setBusy(false);
    }
  };

  return (
    <>
      {showTrigger ? (
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Ajouter un document
        </Button>
      ) : null}

      <SheetForm
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Nouveau document"
        description={
          isLive
            ? "Le fichier est stocké de façon privée : vous seul pouvez y accéder."
            : "Mode démo : le fichier n'est pas conservé, seules les métadonnées le sont."
        }
        actions={
          <>
            <SubmitButton
              type="button"
              pending={busy}
              pendingLabel={file ? "Import…" : "Ajout…"}
              onClick={() => void submit()}
            >
              Ajouter
            </SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="mx-auto block min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              Annuler
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {propertyId ? null : (
            <SelectField
              id="doc-property"
              label="Logement concerné"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Choisir un logement"
              options={data.properties.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              error={errors.target}
            />
          )}

          <FileField
            id="doc-file"
            label="Fichier"
            optional
            file={file}
            onFile={(next) => {
              setFile(next);
              if (next && !name.trim()) {
                setName(next.name.replace(/\.[^.]+$/, ""));
              }
              // Classement automatique : « quittance_aout.pdf » va dans
              // Loyers, « bail_martin.pdf » dans Baux. Sans certitude, on ne
              // touche à rien — un mauvais classement se corrige moins
              // spontanément qu'une absence de classement.
              if (next && !categoryChoisie) {
                const suggestion = guessCategory(next.name);
                setDevinee(suggestion);
                if (suggestion) setCategory(suggestion);
              }
            }}
            progress={progress}
            hint="Sans fichier, seule la fiche du document est créée."
          />

          <SelectField
            id="doc-category"
            label="Catégorie"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as DocumentCategory);
              setCategoryChoisie(true);
              setDevinee(null);
            }}
            options={toOptions(DOCUMENT_CATEGORY_LABELS)}
          />
          {/* Le classement automatique est ANNONCÉ, jamais silencieux : un
              classement qu'on ne voit pas est un classement qu'on ne corrige
              pas, et qui finit par faire perdre confiance au rangement. */}
          {devinee ? (
            <p className="-mt-1 text-xs text-muted-foreground">
              Catégorie devinée d’après le nom du fichier. Corrigez-la si besoin.
            </p>
          ) : null}

          <TextField
            id="doc-name"
            label="Nom du document"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bail de location"
            error={errors.name}
          />

          {/* L'échéance n'est proposée que là où elle veut dire quelque chose :
              une assurance expire, un bail signé non. */}
          {EXPIRING.includes(category) ? (
            <MoreDetails label="Ajouter une échéance">
              <DateField
                id="doc-expires"
                label="Expire le"
                optional
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                hint="Nireo vous préviendra 30 jours avant."
              />
            </MoreDetails>
          ) : null}
        </div>
      </SheetForm>
    </>
  );
}
