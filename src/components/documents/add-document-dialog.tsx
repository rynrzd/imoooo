"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { PropertySelectItems } from "@/components/shared/property-select";
import { DOCUMENT_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";

const schema = z.object({
  name: z.string().min(2, "Nom du document requis."),
  propertyId: z.string().min(1, "Choisissez un logement."),
  category: z.enum([
    "bail",
    "etat_des_lieux",
    "assurance",
    "diagnostics",
    "factures",
    "garanties",
    "autres",
  ]),
});

type FormValues = z.infer<typeof schema>;

interface AddDocumentDialogProps {
  /** Pré-sélectionne un logement (fiche logement). */
  propertyId?: string;
  /** Fichier déjà choisi (glisser-déposer depuis la bibliothèque). */
  droppedFile?: File | null;
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

/** Ajout d'un document : fichier envoyé dans le bucket privé + métadonnées. */
export function AddDocumentDialog({
  propertyId,
  droppedFile = null,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddDocumentDialogProps) {
  const { addDocument, isLive } = useAppStore();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const fileRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { propertyId: propertyId ?? "", category: "autres" },
  });

  // Un fichier déposé pré-remplit le nom du document.
  React.useEffect(() => {
    if (open && droppedFile) {
      setValue("name", droppedFile.name.replace(/\.[^.]+$/, ""));
    }
  }, [open, droppedFile, setValue]);

  // handleSubmit est appelé dans le gestionnaire d'événement (accès au ref autorisé).
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(async (values) => {
    try {
      const file = droppedFile ?? fileRef.current?.files?.[0];
      await addDocument(values, file);
      toast.success(
        file ? "Document et fichier ajoutés." : "Document ajouté à la bibliothèque."
      );
      reset({ propertyId: propertyId ?? "", category: "autres", name: "" });
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ajout impossible.");
    }
    })(event);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger render={<Button />}>
          <Plus data-icon="inline-start" />
          Ajouter un document
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau document</DialogTitle>
          <DialogDescription>
            {isLive
              ? "Le fichier est stocké de façon privée : vous seul pouvez y accéder."
              : "Mode démo : le fichier n'est pas conservé, seules les métadonnées le sont."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Nom du document" htmlFor="doc-name" error={errors.name?.message}>
            <Input id="doc-name" placeholder="Bail de location — ..." {...register("name")} />
          </FormField>

          {!propertyId ? (
            <FormField label="Logement" htmlFor="doc-property" error={errors.propertyId?.message}>
              <Controller
                control={control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="doc-property" className="w-full">
                      <SelectValue placeholder="Choisir un logement" />
                    </SelectTrigger>
                    <SelectContent>
                      <PropertySelectItems />
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : null}

          <FormField label="Catégorie" htmlFor="doc-category" error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="doc-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toOptions(DOCUMENT_CATEGORY_LABELS).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          {droppedFile ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Fichier sélectionné :{" "}
              <span className="font-medium text-foreground">{droppedFile.name}</span>
            </p>
          ) : (
            <FormField label="Fichier (optionnel)" htmlFor="doc-file">
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                ref={fileRef}
              />
            </FormField>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
