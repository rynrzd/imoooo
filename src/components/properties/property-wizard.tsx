"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  FileText,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { DropZone } from "@/components/shared/drop-zone";
import { FormField } from "@/components/shared/form-field";
import { todayISO } from "@/lib/dates";
import { formatCurrency, formatPercent } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { DocumentCategory, PropertyType } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROPERTY_TYPES: PropertyType[] = ["Studio", "T1", "T2", "T3", "T4", "T5", "Maison"];

const schema = z
  .object({
    // Étape 1 — informations
    name: z.string().min(2, "Donnez un nom court au logement."),
    address: z.string().min(4, "Adresse requise."),
    postalCode: z.string().regex(/^\d{5}$/, "Code postal à 5 chiffres."),
    city: z.string().min(2, "Ville requise."),
    type: z.enum(PROPERTY_TYPES as [PropertyType, ...PropertyType[]]),
    surface: z.number({ message: "Surface requise." }).positive("Surface invalide."),
    rooms: z.number({ message: "Pièces requises." }).int().min(1, "Au moins 1 pièce."),
    // Étape 4 — finances
    purchasePrice: z.number({ message: "Prix requis." }).positive("Prix invalide."),
    purchaseDate: z.string().min(1, "Date requise."),
    rent: z.number({ message: "Loyer requis." }).positive("Loyer invalide."),
    charges: z.number({ message: "Charges requises." }).min(0, "Charges invalides."),
    propertyTax: z.number().min(0, "Montant invalide.").optional(),
    insurance: z.number().min(0, "Montant invalide.").optional(),
    // Étape 5 — locataire
    tenantMode: z.enum(["skip", "create"]),
    tenantFirstName: z.string().optional(),
    tenantLastName: z.string().optional(),
    tenantEmail: z.string().optional(),
    tenantPhone: z.string().optional(),
    tenantEntryDate: z.string().optional(),
    tenantDeposit: z.number().min(0, "Dépôt invalide.").optional(),
  })
  .superRefine((values, ctx) => {
    if (values.tenantMode !== "create") return;
    const require = (field: keyof typeof values, message: string, min = 1) => {
      const value = values[field];
      if (typeof value !== "string" || value.trim().length < min) {
        ctx.addIssue({ code: "custom", path: [field], message });
      }
    };
    require("tenantFirstName", "Prénom requis.", 2);
    require("tenantLastName", "Nom requis.", 2);
    require("tenantPhone", "Téléphone requis.", 10);
    require("tenantEntryDate", "Date d'entrée requise.");
    if (!z.string().email().safeParse(values.tenantEmail ?? "").success) {
      ctx.addIssue({ code: "custom", path: ["tenantEmail"], message: "E-mail invalide." });
    }
  });

type FormValues = z.infer<typeof schema>;

const STEPS = [
  { id: "infos", title: "Informations" },
  { id: "photos", title: "Photos" },
  { id: "documents", title: "Documents" },
  { id: "finances", title: "Finances" },
  { id: "locataire", title: "Locataire" },
  { id: "resume", title: "Résumé" },
] as const;

/** Champs validés avant de quitter chaque étape. */
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["name", "address", "postalCode", "city", "type", "surface", "rooms"],
  [],
  [],
  ["purchasePrice", "purchaseDate", "rent", "charges", "propertyTax", "insurance"],
  [
    "tenantFirstName",
    "tenantLastName",
    "tenantEmail",
    "tenantPhone",
    "tenantEntryDate",
    "tenantDeposit",
  ],
  [],
];

interface QueuedPhoto {
  id: string;
  file: File;
  /** URL objet locale pour la prévisualisation. */
  previewUrl: string;
}

interface QueuedDocument {
  id: string;
  file: File;
  category: DocumentCategory;
}

const DEFAULTS: Partial<FormValues> = {
  type: "T2",
  charges: 0,
  tenantMode: "skip",
};

let queueId = 0;
const nextQueueId = () => `q-${++queueId}`;

interface PropertyWizardProps {
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Assistant de création d'un logement en 6 étapes.
 * À la validation, le dossier complet est constitué : logement, photos
 * (avec photo principale), documents classés, bail éventuel, historique.
 */
export function PropertyWizard({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: PropertyWizardProps) {
  const { addProperty, updateProperty, addPhoto, addDocument, addTenant } =
    useAppStore();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [step, setStep] = React.useState(0);
  const [photos, setPhotos] = React.useState<QueuedPhoto[]>([]);
  const [mainPhotoId, setMainPhotoId] = React.useState<string | null>(null);
  const [documents, setDocuments] = React.useState<QueuedDocument[]>([]);
  const [creating, setCreating] = React.useState(false);

  const {
    register,
    control,
    reset,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const tenantMode = watch("tenantMode");
  const rent = watch("rent");
  const purchasePrice = watch("purchasePrice");
  const propertyTax = watch("propertyTax");
  const insurance = watch("insurance");

  const grossYield =
    rent > 0 && purchasePrice > 0 ? (rent * 12 * 100) / purchasePrice : null;
  const netYield =
    grossYield !== null
      ? ((rent * 12 - (propertyTax ?? 0) - (insurance ?? 0)) * 100) / purchasePrice
      : null;

  const releasePreviews = React.useCallback((items: QueuedPhoto[]) => {
    for (const item of items) URL.revokeObjectURL(item.previewUrl);
  }, []);

  const resetWizard = () => {
    reset(DEFAULTS);
    setStep(0);
    releasePreviews(photos);
    setPhotos([]);
    setMainPhotoId(null);
    setDocuments([]);
  };

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const addQueuedPhoto = (file: File) => {
    const item: QueuedPhoto = {
      id: nextQueueId(),
      file,
      previewUrl: URL.createObjectURL(file),
    };
    setPhotos((prev) => [...prev, item]);
    setMainPhotoId((prev) => prev ?? item.id);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = prev.filter((p) => p.id !== id);
      setMainPhotoId((main) => (main === id ? (next[0]?.id ?? null) : main));
      return next;
    });
  };

  const movePhoto = (id: string, delta: -1 | 1) => {
    setPhotos((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const create = async () => {
    const values = getValues();
    setCreating(true);
    try {
      // 1. Le logement lui-même.
      const property = await addProperty({
        name: values.name,
        address: values.address,
        postalCode: values.postalCode,
        city: values.city,
        type: values.type,
        surface: values.surface,
        rooms: values.rooms,
        purchasePrice: values.purchasePrice,
        purchaseDate: values.purchaseDate,
        rent: values.rent,
        charges: values.charges,
        status: "vacant",
        photo: "",
      });

      // 2. Les photos, avec la photo principale du dossier.
      let mainUrl: string | null = null;
      for (const [index, item] of photos.entries()) {
        const created = await addPhoto(
          {
            propertyId: property.id,
            caption: `${values.name} — photo ${index + 1}`,
            category: "entree",
            url: "",
            takenAt: todayISO(),
          },
          item.file
        );
        if (item.id === mainPhotoId) mainUrl = created.url;
      }
      if (mainUrl) {
        await updateProperty(property.id, {
          name: values.name,
          address: values.address,
          postalCode: values.postalCode,
          city: values.city,
          type: values.type,
          surface: values.surface,
          rooms: values.rooms,
          purchasePrice: values.purchasePrice,
          purchaseDate: values.purchaseDate,
          rent: values.rent,
          charges: values.charges,
          status: "vacant",
          photo: mainUrl,
        });
      }

      // 3. Les documents, classés par catégorie.
      for (const doc of documents) {
        await addDocument(
          {
            propertyId: property.id,
            name: doc.file.name.replace(/\.[^.]+$/, ""),
            category: doc.category,
          },
          doc.file
        );
      }

      // 4. Le bail éventuel (passe le logement en « Loué »).
      if (values.tenantMode === "create") {
        await addTenant({
          propertyId: property.id,
          firstName: values.tenantFirstName ?? "",
          lastName: values.tenantLastName ?? "",
          email: values.tenantEmail ?? "",
          phone: values.tenantPhone ?? "",
          entryDate: values.tenantEntryDate ?? todayISO(),
          rent: values.rent,
          charges: values.charges,
          deposit: values.tenantDeposit ?? values.rent,
        });
      }

      toast.success(`${values.name} créé — son dossier complet est prêt.`);
      resetWizard();
      setOpen(false);
      router.push(`/logements/${property.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  };

  const values = getValues();
  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetWizard();
      }}
    >
      {showTrigger ? (
        <DialogTrigger render={<Button />}>
          <Plus data-icon="inline-start" />
          Ajouter un logement
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau logement</DialogTitle>
          <DialogDescription>
            Étape {step + 1} sur {STEPS.length} — {STEPS[step].title}
          </DialogDescription>
        </DialogHeader>

        {/* Indicateur d'étapes */}
        <ol className="flex items-center gap-1.5" aria-label="Progression">
          {STEPS.map((s, index) => (
            <li key={s.id} className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1 rounded-full transition-colors duration-300",
                  index <= step ? "bg-foreground" : "bg-muted"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "truncate text-[11px]",
                  index === step ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {s.title}
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-4">
          {step === 0 ? (
            <div className="animate-panel-in space-y-4">
              <FormField label="Nom du logement" htmlFor="pw-name" error={errors.name?.message}>
                <Input id="pw-name" placeholder="T2 Part-Dieu" {...register("name")} />
              </FormField>
              <FormField label="Adresse" htmlFor="pw-address" error={errors.address?.message}>
                <Input id="pw-address" placeholder="12 avenue Félix Faure" {...register("address")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Code postal" htmlFor="pw-postal" error={errors.postalCode?.message}>
                  <Input id="pw-postal" inputMode="numeric" placeholder="69003" {...register("postalCode")} />
                </FormField>
                <FormField label="Ville" htmlFor="pw-city" error={errors.city?.message}>
                  <Input id="pw-city" placeholder="Lyon" {...register("city")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <FormField label="Type" htmlFor="pw-type" error={errors.type?.message}>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="pw-type" className="w-full">
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
                <FormField label="Surface (m²)" htmlFor="pw-surface" error={errors.surface?.message}>
                  <Input id="pw-surface" type="number" min={1} placeholder="42" {...register("surface", { valueAsNumber: true })} />
                </FormField>
                <FormField label="Pièces" htmlFor="pw-rooms" error={errors.rooms?.message}>
                  <Input id="pw-rooms" type="number" min={1} placeholder="2" {...register("rooms", { valueAsNumber: true })} />
                </FormField>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="animate-panel-in space-y-4">
              <DropZone
                label="Glissez-déposez les photos du logement"
                hint="ou cliquez pour choisir — la première devient la photo principale"
                accept="image/*"
                multiple
                onFile={addQueuedPhoto}
              />
              {photos.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo, index) => (
                    <li
                      key={photo.id}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border",
                        photo.id === mainPhotoId ? "border-foreground" : "border-border"
                      )}
                    >
                      <div className="relative aspect-[4/3] bg-muted">
                        <Image
                          src={photo.previewUrl}
                          alt={`Photo ${index + 1}`}
                          fill
                          sizes="200px"
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 p-1.5">
                        <Button
                          type="button"
                          variant={photo.id === mainPhotoId ? "secondary" : "ghost"}
                          size="icon-xs"
                          aria-label={
                            photo.id === mainPhotoId
                              ? "Photo principale"
                              : `Définir la photo ${index + 1} comme principale`
                          }
                          onClick={() => setMainPhotoId(photo.id)}
                        >
                          <Star
                            className={cn(
                              photo.id === mainPhotoId && "fill-current"
                            )}
                          />
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Monter la photo"
                            disabled={index === 0}
                            onClick={() => movePhoto(photo.id, -1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Descendre la photo"
                            disabled={index === photos.length - 1}
                            onClick={() => movePhoto(photo.id, 1)}
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Retirer la photo"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removePhoto(photo.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Facultatif — vous pourrez aussi ajouter des photos plus tard.
                </p>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="animate-panel-in space-y-4">
              <DropZone
                label="Glissez-déposez les documents du logement"
                hint="bail, DPE, diagnostics, factures, plans, assurance — PDF, image ou Word"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                multiple
                onFile={(file) =>
                  setDocuments((prev) => [
                    ...prev,
                    { id: nextQueueId(), file, category: "autres" },
                  ])
                }
              />
              {documents.length > 0 ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {doc.file.name}
                      </span>
                      <Select
                        value={doc.category}
                        onValueChange={(value) =>
                          setDocuments((prev) =>
                            prev.map((d) =>
                              d.id === doc.id
                                ? { ...d, category: (value ?? "autres") as DocumentCategory }
                                : d
                            )
                          )
                        }
                      >
                        <SelectTrigger
                          className="w-40"
                          aria-label={`Catégorie de ${doc.file.name}`}
                        >
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Retirer ${doc.file.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Facultatif — la bibliothèque documentaire reste accessible à tout moment.
                </p>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="animate-panel-in space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prix d'achat (€)" htmlFor="pw-price" error={errors.purchasePrice?.message}>
                  <Input id="pw-price" type="number" min={0} placeholder="189 000" {...register("purchasePrice", { valueAsNumber: true })} />
                </FormField>
                <FormField label="Date d'achat" htmlFor="pw-date" error={errors.purchaseDate?.message}>
                  <Input id="pw-date" type="date" {...register("purchaseDate")} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Loyer (€ / mois)" htmlFor="pw-rent" error={errors.rent?.message}>
                  <Input id="pw-rent" type="number" min={0} placeholder="780" {...register("rent", { valueAsNumber: true })} />
                </FormField>
                <FormField label="Charges (€ / mois)" htmlFor="pw-charges" error={errors.charges?.message}>
                  <Input id="pw-charges" type="number" min={0} placeholder="60" {...register("charges", { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Taxe foncière (€ / an, optionnel)"
                  htmlFor="pw-tax"
                  error={errors.propertyTax?.message}
                >
                  <Input id="pw-tax" type="number" min={0} placeholder="900" {...register("propertyTax", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
                </FormField>
                <FormField
                  label="Assurance PNO (€ / an, optionnel)"
                  htmlFor="pw-insurance"
                  error={errors.insurance?.message}
                >
                  <Input id="pw-insurance" type="number" min={0} placeholder="150" {...register("insurance", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
                </FormField>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">Rentabilité calculée</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <p className="text-sm text-foreground">
                    Brute :{" "}
                    <span className="font-semibold tabular-nums">
                      {grossYield !== null ? formatPercent(grossYield) : "—"}
                    </span>
                  </p>
                  <p className="text-sm text-foreground">
                    Nette estimée :{" "}
                    <span className="font-semibold tabular-nums">
                      {netYield !== null ? formatPercent(netYield) : "—"}
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Taxe et assurance servent uniquement à cette estimation.
                </p>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="animate-panel-in space-y-4">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Locataire">
                <button
                  type="button"
                  role="radio"
                  aria-checked={tenantMode === "create"}
                  onClick={() =>
                    reset({ ...getValues(), tenantMode: "create" }, { keepErrors: false })
                  }
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    tenantMode === "create"
                      ? "border-foreground bg-muted font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  Créer le locataire maintenant
                  <span className="block text-xs font-normal text-muted-foreground">
                    Le bail démarre immédiatement.
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tenantMode === "skip"}
                  onClick={() =>
                    reset({ ...getValues(), tenantMode: "skip" }, { keepErrors: false })
                  }
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    tenantMode === "skip"
                      ? "border-foreground bg-muted font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  Passer cette étape
                  <span className="block text-xs font-normal text-muted-foreground">
                    Le logement sera créé vacant.
                  </span>
                </button>
              </div>

              {tenantMode === "create" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Prénom" htmlFor="pw-t-first" error={errors.tenantFirstName?.message}>
                      <Input id="pw-t-first" placeholder="Camille" {...register("tenantFirstName")} />
                    </FormField>
                    <FormField label="Nom" htmlFor="pw-t-last" error={errors.tenantLastName?.message}>
                      <Input id="pw-t-last" placeholder="Roux" {...register("tenantLastName")} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="E-mail" htmlFor="pw-t-email" error={errors.tenantEmail?.message}>
                      <Input id="pw-t-email" type="email" placeholder="camille@exemple.fr" {...register("tenantEmail")} />
                    </FormField>
                    <FormField label="Téléphone" htmlFor="pw-t-phone" error={errors.tenantPhone?.message}>
                      <Input id="pw-t-phone" type="tel" placeholder="06 12 34 56 78" {...register("tenantPhone")} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Date d'entrée" htmlFor="pw-t-entry" error={errors.tenantEntryDate?.message}>
                      <Input id="pw-t-entry" type="date" {...register("tenantEntryDate")} />
                    </FormField>
                    <FormField label="Dépôt de garantie (€)" htmlFor="pw-t-deposit" error={errors.tenantDeposit?.message}>
                      <Input id="pw-t-deposit" type="number" min={0} placeholder="780" {...register("tenantDeposit", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
                    </FormField>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Loyer et charges reprennent les montants de l&apos;étape Finances.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="animate-panel-in space-y-1">
              <dl className="divide-y divide-border">
                <SummaryRow label="Logement" value={values.name || "—"} />
                <SummaryRow
                  label="Adresse"
                  value={`${values.address}, ${values.postalCode} ${values.city}`}
                />
                <SummaryRow
                  label="Bien"
                  value={`${values.type} · ${values.surface || 0} m² · ${values.rooms || 0} pièce${(values.rooms || 0) > 1 ? "s" : ""}`}
                />
                <SummaryRow
                  label="Finances"
                  value={`${formatCurrency(values.purchasePrice || 0)} · loyer ${formatCurrency(values.rent || 0)} + ${formatCurrency(values.charges || 0)}`}
                />
                <SummaryRow
                  label="Rentabilité brute"
                  value={grossYield !== null ? formatPercent(grossYield) : "—"}
                />
                <SummaryRow
                  label="Photos"
                  value={
                    photos.length > 0
                      ? `${photos.length} photo${photos.length > 1 ? "s" : ""} (1 principale)`
                      : "Aucune"
                  }
                />
                <SummaryRow
                  label="Documents"
                  value={
                    documents.length > 0
                      ? `${documents.length} document${documents.length > 1 ? "s" : ""} classé${documents.length > 1 ? "s" : ""}`
                      : "Aucun"
                  }
                />
                <SummaryRow
                  label="Locataire"
                  value={
                    values.tenantMode === "create"
                      ? `${values.tenantFirstName ?? ""} ${values.tenantLastName ?? ""}`.trim() || "—"
                      : "Aucun (logement vacant)"
                  }
                />
              </dl>
              <Separator />
              <p className="pt-2 text-xs text-muted-foreground">
                Le dossier complet du logement sera créé : photos, documents,
                finances, historique{values.tenantMode === "create" ? " et bail" : ""}.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={creating}>
              <ArrowLeft data-icon="inline-start" />
              Retour
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          )}
          {isLastStep ? (
            <Button type="button" onClick={() => void create()} disabled={creating}>
              {creating ? (
                "Création du dossier…"
              ) : (
                <>
                  <Check data-icon="inline-start" />
                  Créer le logement
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={() => void goNext()}>
              Continuer
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
