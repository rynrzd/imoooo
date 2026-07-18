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
import { todayISO } from "@/lib/dates";
import { PHOTO_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";

const FALLBACK_URL =
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=75";

const schema = z.object({
  caption: z.string().min(2, "Légende requise."),
  propertyId: z.string().min(1, "Choisissez un logement."),
  category: z.enum(["avant_location", "apres_travaux", "entree", "sortie", "dommages"]),
  url: z
    .union([z.literal(""), z.string().url("URL invalide.")])
    .optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddPhotoDialogProps {
  propertyId?: string;
  /** Fichier déjà choisi (glisser-déposer). */
  droppedFile?: File | null;
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

/** Ajout d'une photo : fichier envoyé dans le bucket privé, ou URL externe. */
export function AddPhotoDialog({
  propertyId,
  droppedFile = null,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddPhotoDialogProps) {
  const { addPhoto } = useAppStore();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const fileRef = React.useRef<HTMLInputElement>(null);

  const defaults: Partial<FormValues> = {
    propertyId: propertyId ?? "",
    category: "entree",
    url: "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  // handleSubmit est appelé dans le gestionnaire d'événement (accès au ref autorisé).
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(async (values) => {
    try {
      const file = droppedFile ?? fileRef.current?.files?.[0];
      await addPhoto(
        {
          caption: values.caption,
          propertyId: values.propertyId,
          category: values.category,
          url: values.url || FALLBACK_URL,
          takenAt: todayISO(),
        },
        file
      );
      toast.success("Photo ajoutée à la galerie.");
      reset(defaults);
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
          Ajouter une photo
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle photo</DialogTitle>
          <DialogDescription>
            Renseignez une URL d&apos;image, ou laissez vide pour un visuel de
            démonstration.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Légende" htmlFor="photo-caption" error={errors.caption?.message}>
            <Input id="photo-caption" placeholder="Séjour après travaux" {...register("caption")} />
          </FormField>

          {!propertyId ? (
            <FormField label="Logement" htmlFor="photo-property" error={errors.propertyId?.message}>
              <Controller
                control={control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="photo-property" className="w-full">
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

          <FormField label="Catégorie" htmlFor="photo-category" error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="photo-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toOptions(PHOTO_CATEGORY_LABELS).map((option) => (
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
              Image sélectionnée :{" "}
              <span className="font-medium text-foreground">{droppedFile.name}</span>
            </p>
          ) : (
            <>
              <FormField label="Fichier (optionnel)" htmlFor="photo-file">
                <Input id="photo-file" type="file" accept="image/*" ref={fileRef} />
              </FormField>

              <FormField
                label="Ou URL de l'image (optionnel)"
                htmlFor="photo-url"
                error={errors.url?.message}
              >
                <Input id="photo-url" placeholder="https://…" {...register("url")} />
              </FormField>
            </>
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
