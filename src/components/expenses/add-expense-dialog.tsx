"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
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
import { EXPENSE_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { Expense } from "@/lib/types";

const schema = z.object({
  label: z.string().min(2, "Libellé requis."),
  propertyId: z.string().min(1, "Choisissez un logement."),
  category: z.enum(["travaux", "assurance", "taxe_fonciere", "copropriete", "autres"]),
  amount: z.number({ message: "Montant requis." }).positive("Montant invalide."),
  date: z.string().min(1, "Date requise."),
  supplier: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface AddExpenseDialogProps {
  propertyId?: string;
  /** En édition, la dépense à modifier. */
  expense?: Expense;
  /** Mode contrôlé (ouverture pilotée par le parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

/** Création / modification d'une dépense, avec justificatif optionnel. */
export function AddExpenseDialog({
  propertyId,
  expense,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddExpenseDialogProps) {
  const { addExpense, updateExpense, isLive } = useAppStore();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isEdit = Boolean(expense);

  const defaults: Partial<FormValues> = expense
    ? {
        label: expense.label,
        propertyId: expense.propertyId,
        category: expense.category,
        amount: expense.amount,
        date: expense.date,
        supplier: expense.supplier ?? "",
      }
    : { propertyId: propertyId ?? "", category: "autres", supplier: "" };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(async (values) => {
      try {
        const file = fileRef.current?.files?.[0];
        if (expense) {
          await updateExpense(expense.id, values, file);
          toast.success("Dépense mise à jour.");
        } else {
          await addExpense(values, file);
          toast.success("Dépense enregistrée.");
          reset(defaults);
        }
        if (fileRef.current) fileRef.current.value = "";
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    })(event);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults);
      }}
    >
      {showTrigger ? (
        isEdit ? (
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Modifier la dépense ${expense?.label ?? ""}`}
              />
            }
          >
            <Pencil />
          </DialogTrigger>
        ) : (
          <DialogTrigger render={<Button />}>
            <Plus data-icon="inline-start" />
            Ajouter une dépense
          </DialogTrigger>
        )
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          <DialogDescription>
            {isLive
              ? "Le justificatif est stocké de façon privée dans votre espace."
              : "Mode démo : la dépense n'est conservée que le temps de la session."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Libellé" htmlFor="exp-label" error={errors.label?.message}>
            <Input id="exp-label" placeholder="Taxe foncière 2026" {...register("label")} />
          </FormField>

          {!propertyId && !expense ? (
            <FormField label="Logement" htmlFor="exp-property" error={errors.propertyId?.message}>
              <Controller
                control={control}
                name="propertyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="exp-property" className="w-full">
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
            <FormField label="Montant (€)" htmlFor="exp-amount" error={errors.amount?.message}>
              <Input
                id="exp-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="890"
                {...register("amount", { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Date" htmlFor="exp-date" error={errors.date?.message}>
              <Input id="exp-date" type="date" {...register("date")} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Catégorie" htmlFor="exp-category" error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="exp-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toOptions(EXPENSE_CATEGORY_LABELS).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Fournisseur (optionnel)" htmlFor="exp-supplier">
              <Input id="exp-supplier" placeholder="Trésor public" {...register("supplier")} />
            </FormField>
          </div>

          <FormField
            label={
              expense?.receiptPath
                ? "Remplacer le justificatif (optionnel)"
                : "Justificatif (optionnel)"
            }
            htmlFor="exp-receipt"
          >
            <Input
              id="exp-receipt"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              ref={fileRef}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
