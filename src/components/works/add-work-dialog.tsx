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
import { WORK_STATUS_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";

const schema = z.object({
  title: z.string().min(3, "Titre requis."),
  company: z.string().min(2, "Entreprise requise."),
  propertyId: z.string().min(1, "Choisissez un logement."),
  amount: z.number({ message: "Montant requis." }).positive("Montant invalide."),
  date: z.string().min(1, "Date requise."),
  status: z.enum(["planifie", "en_cours", "termine"]),
});

type FormValues = z.infer<typeof schema>;

interface AddWorkDialogProps {
  propertyId?: string;
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

/** Ajout de travaux — crée aussi la dépense associée. */
export function AddWorkDialog({
  propertyId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddWorkDialogProps) {
  const { addWork } = useAppStore();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const defaults: Partial<FormValues> = {
    propertyId: propertyId ?? "",
    status: "planifie",
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

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addWork(values);
      toast.success("Travaux ajoutés (dépense créée automatiquement).");
      reset(defaults);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ajout impossible.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger render={<Button />}>
          <Plus data-icon="inline-start" />
          Ajouter des travaux
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveaux travaux</DialogTitle>
          <DialogDescription>
            Le montant sera automatiquement comptabilisé dans vos dépenses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Titre" htmlFor="work-title" error={errors.title?.message}>
            <Input id="work-title" placeholder="Réfection de la salle de bain" {...register("title")} />
          </FormField>

          <FormField label="Entreprise" htmlFor="work-company" error={errors.company?.message}>
            <Input id="work-company" placeholder="SARL Habitat Plus" {...register("company")} />
          </FormField>

          {!propertyId ? (
            <FormField label="Logement" htmlFor="work-property" error={errors.propertyId?.message}>
              <Controller
                control={control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="work-property" className="w-full">
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

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Montant (€)" htmlFor="work-amount" error={errors.amount?.message}>
              <Input
                id="work-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="4 900"
                {...register("amount", { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Date" htmlFor="work-date" error={errors.date?.message}>
              <Input id="work-date" type="date" {...register("date")} />
            </FormField>
          </div>

          <FormField label="Statut" htmlFor="work-status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="work-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toOptions(WORK_STATUS_LABELS).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

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
