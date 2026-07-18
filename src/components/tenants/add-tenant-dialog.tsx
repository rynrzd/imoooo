"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
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
import { FormField } from "@/components/shared/form-field";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { saveGuarantor } from "@/lib/tenant-dossier";
import { cn } from "@/lib/utils";

const schema = z.object({
  firstName: z.string().min(2, "Prénom requis."),
  lastName: z.string().min(2, "Nom requis."),
  email: z.string().email("E-mail invalide."),
  phone: z.string().min(10, "Téléphone requis."),
  propertyId: z.string().min(1, "Choisissez un logement."),
  entryDate: z.string().min(1, "Date d'entrée requise."),
  rent: z.number({ message: "Loyer requis." }).positive("Loyer invalide."),
  charges: z.number({ message: "Charges requises." }).min(0, "Charges invalides."),
  deposit: z.number({ message: "Dépôt requis." }).min(0, "Dépôt invalide."),
  // Garant (étape optionnelle).
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorEmail: z
    .union([z.literal(""), z.string().email("E-mail invalide.")])
    .optional(),
});

type FormValues = z.infer<typeof schema>;

const STEPS = [
  { id: "informations", title: "Informations" },
  { id: "bail", title: "Bail" },
  { id: "garant", title: "Garant" },
  { id: "documents", title: "Documents" },
  { id: "resume", title: "Résumé" },
] as const;

/** Champs validés avant de quitter chaque étape. */
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["firstName", "lastName", "email", "phone"],
  ["propertyId", "entryDate", "rent", "charges", "deposit"],
  ["guarantorEmail"],
  [],
  [],
];

interface AddTenantDialogProps {
  propertyId?: string;
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

/** Ligne du résumé final. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Assistant d'ajout d'un locataire en 5 étapes :
 * informations, bail, garant, documents, résumé puis validation.
 * Le logement choisi passe automatiquement au statut « Loué ».
 */
export function AddTenantDialog({
  propertyId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddTenantDialogProps) {
  const { data, addTenant, addDocument } = useAppStore();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [step, setStep] = React.useState(0);
  const leaseFileRef = React.useRef<HTMLInputElement>(null);
  const inventoryFileRef = React.useRef<HTMLInputElement>(null);
  // Noms de fichiers affichés dans l'étape Documents et le résumé.
  const [fileNames, setFileNames] = React.useState<{ lease?: string; inventory?: string }>({});

  // Seuls les logements sans locataire en place sont proposés.
  const availableProperties = data.properties.filter((p) => !p.currentTenantId);

  const defaults: Partial<FormValues> = {
    propertyId: propertyId ?? "",
    charges: 0,
    guarantorName: "",
    guarantorPhone: "",
    guarantorEmail: "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const resetWizard = () => {
    reset(defaults);
    setStep(0);
    setFileNames({});
    if (leaseFileRef.current) leaseFileRef.current.value = "";
    if (inventoryFileRef.current) inventoryFileRef.current.value = "";
  };

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(async (values) => {
      try {
        await addTenant({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          propertyId: values.propertyId,
          entryDate: values.entryDate,
          rent: values.rent,
          charges: values.charges,
          deposit: values.deposit,
        });

        // Garant : conservé localement, rattaché au dossier du locataire.
        if (values.guarantorName?.trim()) {
          saveGuarantor(values.email, {
            name: values.guarantorName.trim(),
            phone: values.guarantorPhone?.trim() || undefined,
            email: values.guarantorEmail?.trim() || undefined,
          });
        }

        // Documents du bail : classés automatiquement dans la bibliothèque.
        const leaseFile = leaseFileRef.current?.files?.[0];
        const inventoryFile = inventoryFileRef.current?.files?.[0];
        if (leaseFile) {
          await addDocument(
            {
              propertyId: values.propertyId,
              name: `Bail — ${values.firstName} ${values.lastName}`,
              category: "bail",
            },
            leaseFile
          );
        }
        if (inventoryFile) {
          await addDocument(
            {
              propertyId: values.propertyId,
              name: `État des lieux d'entrée — ${values.firstName} ${values.lastName}`,
              category: "etat_des_lieux",
            },
            inventoryFile
          );
        }

        toast.success(
          `${values.firstName} ${values.lastName} ajouté comme locataire.`
        );
        resetWizard();
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ajout impossible.");
      }
    })(event);

  const values = getValues();
  const property = data.properties.find((p) => p.id === values.propertyId);
  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Réinitialisé à la fermeture : l'ouverture contrôlée reste propre.
        if (!next) resetWizard();
      }}
    >
      {showTrigger ? (
        <DialogTrigger render={<Button />}>
          <Plus data-icon="inline-start" />
          Ajouter un locataire
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau locataire</DialogTitle>
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
                  index === step
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {s.title}
              </span>
            </li>
          ))}
        </ol>

        <form onSubmit={onSubmit} className="space-y-4">
          {step === 0 ? (
            <div className="animate-panel-in space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prénom" htmlFor="tenant-firstname" error={errors.firstName?.message}>
                  <Input id="tenant-firstname" placeholder="Camille" {...register("firstName")} />
                </FormField>
                <FormField label="Nom" htmlFor="tenant-lastname" error={errors.lastName?.message}>
                  <Input id="tenant-lastname" placeholder="Roux" {...register("lastName")} />
                </FormField>
              </div>
              <FormField label="E-mail" htmlFor="tenant-email" error={errors.email?.message}>
                <Input id="tenant-email" type="email" placeholder="camille@exemple.fr" {...register("email")} />
              </FormField>
              <FormField label="Téléphone" htmlFor="tenant-phone" error={errors.phone?.message}>
                <Input id="tenant-phone" type="tel" placeholder="06 12 34 56 78" {...register("phone")} />
              </FormField>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="animate-panel-in space-y-4">
              {!propertyId ? (
                <FormField label="Logement" htmlFor="tenant-property" error={errors.propertyId?.message}>
                  <Controller
                    control={control}
                    name="propertyId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="tenant-property" className="w-full">
                          <SelectValue placeholder="Choisir un logement disponible" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProperties.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              ) : null}
              <FormField label="Date d'entrée" htmlFor="tenant-entry" error={errors.entryDate?.message}>
                <Input id="tenant-entry" type="date" {...register("entryDate")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <FormField label="Loyer (€ / mois)" htmlFor="tenant-rent" error={errors.rent?.message}>
                  <Input
                    id="tenant-rent"
                    type="number"
                    min={0}
                    placeholder="780"
                    {...register("rent", { valueAsNumber: true })}
                  />
                </FormField>
                <FormField label="Charges (€ / mois)" htmlFor="tenant-charges" error={errors.charges?.message}>
                  <Input
                    id="tenant-charges"
                    type="number"
                    min={0}
                    placeholder="60"
                    {...register("charges", { valueAsNumber: true })}
                  />
                </FormField>
                <FormField label="Dépôt de garantie (€)" htmlFor="tenant-deposit" error={errors.deposit?.message}>
                  <Input
                    id="tenant-deposit"
                    type="number"
                    min={0}
                    placeholder="780"
                    {...register("deposit", { valueAsNumber: true })}
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="animate-panel-in space-y-4">
              <p className="text-sm text-muted-foreground">
                Facultatif — renseignez le garant du locataire, il sera rattaché à
                son dossier.
              </p>
              <FormField label="Nom du garant" htmlFor="guarantor-name">
                <Input id="guarantor-name" placeholder="Marie Roux" {...register("guarantorName")} />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Téléphone" htmlFor="guarantor-phone">
                  <Input id="guarantor-phone" type="tel" placeholder="06 98 76 54 32" {...register("guarantorPhone")} />
                </FormField>
                <FormField
                  label="E-mail"
                  htmlFor="guarantor-email"
                  error={errors.guarantorEmail?.message}
                >
                  <Input id="guarantor-email" type="email" placeholder="marie@exemple.fr" {...register("guarantorEmail")} />
                </FormField>
              </div>
            </div>
          ) : null}

          {/* Étape Documents : toujours montée pour conserver les fichiers choisis. */}
          <div
            className={cn(
              "space-y-4",
              step === 3 ? "animate-panel-in" : "hidden"
            )}
          >
              <p className="text-sm text-muted-foreground">
                Facultatif — les fichiers seront classés automatiquement dans la
                bibliothèque de documents du logement.
              </p>
              <FormField label="Bail signé" htmlFor="tenant-lease-file">
                <Input
                  id="tenant-lease-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  ref={leaseFileRef}
                  onChange={(e) =>
                    setFileNames((prev) => ({
                      ...prev,
                      lease: e.target.files?.[0]?.name,
                    }))
                  }
                />
              </FormField>
              <FormField label="État des lieux d'entrée" htmlFor="tenant-inventory-file">
                <Input
                  id="tenant-inventory-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  ref={inventoryFileRef}
                  onChange={(e) =>
                    setFileNames((prev) => ({
                      ...prev,
                      inventory: e.target.files?.[0]?.name,
                    }))
                  }
                />
              </FormField>
          </div>

          {step === 4 ? (
            <div className="animate-panel-in space-y-1">
              <dl className="divide-y divide-border">
                <SummaryRow
                  label="Locataire"
                  value={`${values.firstName} ${values.lastName}`}
                />
                <SummaryRow label="Contact" value={`${values.phone} · ${values.email}`} />
                <SummaryRow label="Logement" value={property?.name ?? "—"} />
                <SummaryRow
                  label="Entrée"
                  value={values.entryDate ? formatDate(values.entryDate) : "—"}
                />
                <SummaryRow
                  label="Loyer"
                  value={`${formatCurrency(values.rent || 0)} + ${formatCurrency(values.charges || 0)} de charges`}
                />
                <SummaryRow
                  label="Dépôt de garantie"
                  value={formatCurrency(values.deposit || 0)}
                />
                <SummaryRow
                  label="Garant"
                  value={values.guarantorName?.trim() || "Aucun"}
                />
                <SummaryRow
                  label="Documents"
                  value={
                    [fileNames.lease, fileNames.inventory].filter(Boolean).join(", ") ||
                    "Aucun"
                  }
                />
              </dl>
              <Separator />
              <p className="pt-2 text-xs text-muted-foreground">
                Le logement passera automatiquement au statut « Loué » et les
                échéances de loyer seront suivies dès ce mois-ci.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={goBack}>
                <ArrowLeft data-icon="inline-start" />
                Retour
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
            )}
            {isLastStep ? (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  "Ajout…"
                ) : (
                  <>
                    <Check data-icon="inline-start" />
                    Valider et créer le bail
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
