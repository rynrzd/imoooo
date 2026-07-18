"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, FileText, Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { FormField } from "@/components/shared/form-field";
import { needsUnoptimized } from "@/lib/constants";
import { PROPERTY_STATUS_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { Property, PropertyType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeletePropertyDialog } from "./delete-property-dialog";

const PROPERTY_TYPES: PropertyType[] = ["Studio", "T1", "T2", "T3", "T4", "T5", "Maison"];

const schema = z.object({
  name: z.string().min(2, "Donnez un nom court au logement."),
  address: z.string().min(4, "Adresse requise."),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal à 5 chiffres."),
  city: z.string().min(2, "Ville requise."),
  type: z.enum(PROPERTY_TYPES as [PropertyType, ...PropertyType[]]),
  surface: z.number({ message: "Surface requise." }).positive("Surface invalide."),
  rooms: z.number({ message: "Pièces requises." }).int().min(1, "Au moins 1 pièce."),
  purchasePrice: z.number({ message: "Prix requis." }).positive("Prix invalide."),
  purchaseDate: z.string().min(1, "Date requise."),
  rent: z.number({ message: "Loyer requis." }).positive("Loyer invalide."),
  charges: z.number({ message: "Charges requises." }).min(0, "Charges invalides."),
  status: z.enum(["loue", "vacant", "travaux"]),
});

type FormValues = z.infer<typeof schema>;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

interface EditPropertySheetProps {
  property: Property;
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

/**
 * Drawer d'édition du logement : informations, finances, photo principale,
 * compléments du dossier et suppression avec confirmation.
 */
export function EditPropertySheet({
  property,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: EditPropertySheetProps) {
  const { data, updateProperty } = useAppStore();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [mainPhoto, setMainPhoto] = React.useState(property.photo);
  const [dialog, setDialog] = React.useState<"photo" | "document" | null>(null);

  const propertyPhotos = data.photos.filter((p) => p.propertyId === property.id);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: property.name,
      address: property.address,
      postalCode: property.postalCode,
      city: property.city,
      type: property.type,
      surface: property.surface,
      rooms: property.rooms,
      purchasePrice: property.purchasePrice,
      purchaseDate: property.purchaseDate,
      rent: property.rent,
      charges: property.charges,
      status: property.status,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProperty(property.id, { ...values, photo: mainPhoto });
      toast.success(`${values.name} mis à jour.`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  });

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            reset();
            setMainPhoto(property.photo);
          }
        }}
      >
        {showTrigger ? (
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <Pencil data-icon="inline-start" />
            Modifier
          </SheetTrigger>
        ) : null}
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-lg data-[side=right]:sm:max-w-lg"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Modifier {property.name}</SheetTitle>
            <SheetDescription>
              Les changements sont appliqués à tout le dossier du logement.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex flex-1 flex-col">
            <div className="flex-1 space-y-6 p-4">
              {/* Informations générales */}
              <section className="space-y-4" aria-label="Informations générales">
                <SectionTitle>Informations générales</SectionTitle>
                <FormField label="Nom du logement" htmlFor="ep-name" error={errors.name?.message}>
                  <Input id="ep-name" {...register("name")} />
                </FormField>
                <FormField label="Adresse" htmlFor="ep-address" error={errors.address?.message}>
                  <Input id="ep-address" {...register("address")} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Code postal" htmlFor="ep-postal" error={errors.postalCode?.message}>
                    <Input id="ep-postal" inputMode="numeric" {...register("postalCode")} />
                  </FormField>
                  <FormField label="Ville" htmlFor="ep-city" error={errors.city?.message}>
                    <Input id="ep-city" {...register("city")} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <FormField label="Type" htmlFor="ep-type" error={errors.type?.message}>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="ep-type" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>
                  <FormField label="Surface (m²)" htmlFor="ep-surface" error={errors.surface?.message}>
                    <Input id="ep-surface" type="number" min={1} {...register("surface", { valueAsNumber: true })} />
                  </FormField>
                  <FormField label="Pièces" htmlFor="ep-rooms" error={errors.rooms?.message}>
                    <Input id="ep-rooms" type="number" min={1} {...register("rooms", { valueAsNumber: true })} />
                  </FormField>
                </div>
                <FormField label="Statut" htmlFor="ep-status" error={errors.status?.message}>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="ep-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {toOptions(PROPERTY_STATUS_LABELS).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </section>

              <Separator />

              {/* Finances */}
              <section className="space-y-4" aria-label="Finances">
                <SectionTitle>Finances</SectionTitle>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Prix d'achat (€)" htmlFor="ep-price" error={errors.purchasePrice?.message}>
                    <Input id="ep-price" type="number" min={0} {...register("purchasePrice", { valueAsNumber: true })} />
                  </FormField>
                  <FormField label="Date d'achat" htmlFor="ep-date" error={errors.purchaseDate?.message}>
                    <Input id="ep-date" type="date" {...register("purchaseDate")} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Loyer (€ / mois)" htmlFor="ep-rent" error={errors.rent?.message}>
                    <Input id="ep-rent" type="number" min={0} {...register("rent", { valueAsNumber: true })} />
                  </FormField>
                  <FormField label="Charges (€ / mois)" htmlFor="ep-charges" error={errors.charges?.message}>
                    <Input id="ep-charges" type="number" min={0} {...register("charges", { valueAsNumber: true })} />
                  </FormField>
                </div>
              </section>

              <Separator />

              {/* Photo principale */}
              <section className="space-y-3" aria-label="Photo principale">
                <SectionTitle>Photo principale</SectionTitle>
                {propertyPhotos.length > 0 ? (
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="radiogroup"
                    aria-label="Choisir la photo principale"
                  >
                    {propertyPhotos.slice(0, 9).map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        role="radio"
                        aria-checked={mainPhoto === photo.url}
                        aria-label={`Photo principale : ${photo.caption}`}
                        onClick={() => setMainPhoto(photo.url)}
                        className={cn(
                          "relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          mainPhoto === photo.url
                            ? "border-foreground"
                            : "border-transparent hover:border-border"
                        )}
                      >
                        <Image
                          src={photo.url}
                          alt={photo.caption}
                          fill
                          sizes="140px"
                          unoptimized={needsUnoptimized(photo.url)}
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ajoutez d&apos;abord des photos au dossier pour en choisir une.
                  </p>
                )}
              </section>

              <Separator />

              {/* Compléments du dossier */}
              <section className="space-y-3" aria-label="Compléments">
                <SectionTitle>Compléter le dossier</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog("photo")}>
                    <Camera data-icon="inline-start" />
                    Ajouter des photos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog("document")}>
                    <FileText data-icon="inline-start" />
                    Ajouter un document
                  </Button>
                </div>
              </section>

              <Separator />

              {/* Zone de danger */}
              <section className="space-y-3" aria-label="Zone de danger">
                <SectionTitle>Zone de danger</SectionTitle>
                <DeletePropertyDialog property={property} />
              </section>
            </div>

            <SheetFooter className="border-t border-border sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {dialog === "photo" ? (
        <AddPhotoDialog
          propertyId={property.id}
          showTrigger={false}
          open
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
        />
      ) : null}
      {dialog === "document" ? (
        <AddDocumentDialog
          propertyId={property.id}
          showTrigger={false}
          open
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
        />
      ) : null}
    </>
  );
}
