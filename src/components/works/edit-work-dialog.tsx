"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
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
import { WORK_STATUS_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { Work } from "@/lib/types";

const optionalNumber = z
  .union([z.nan(), z.number().min(0, "Valeur invalide.")])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? null : v));

const schema = z.object({
  title: z.string().min(3, "Titre requis."),
  company: z.string().min(2, "Entreprise requise."),
  amount: z.number({ message: "Budget requis." }).positive("Budget invalide."),
  date: z.string().min(1, "Date requise."),
  status: z.enum(["planifie", "en_cours", "termine"]),
  actualCost: optionalNumber,
  progress: z
    .union([z.nan(), z.number().min(0, "0 à 100.").max(100, "0 à 100.")])
    .optional()
    .transform((v) => (v === undefined || Number.isNaN(v) ? null : v)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
});

type FormValues = z.input<typeof schema>;
type ParsedValues = z.output<typeof schema>;

/** Modification complète d'un chantier — budget, coût réel, avancement. */
export function EditWorkDialog({ work }: { work: Work }) {
  const { updateWork, deleteWork } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const defaults: FormValues = {
    title: work.title,
    company: work.company,
    amount: work.amount,
    date: work.date,
    status: work.status,
    actualCost: work.actualCost ?? undefined,
    progress: work.progress ?? undefined,
    endDate: work.endDate ?? "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, ParsedValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateWork(work.id, values);
      toast.success("Chantier mis à jour.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    }
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteWork(work.id);
      toast.success("Chantier supprimé (dépense associée retirée).");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaults);
          setConfirmDelete(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${work.title}`} />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le chantier</DialogTitle>
          <DialogDescription>
            La dépense associée est synchronisée (coût réel si renseigné, sinon
            budget).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Titre" htmlFor="work-edit-title" error={errors.title?.message}>
            <Input id="work-edit-title" {...register("title")} />
          </FormField>
          <FormField label="Entreprise" htmlFor="work-edit-company" error={errors.company?.message}>
            <Input id="work-edit-company" {...register("company")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Budget prévu (€)" htmlFor="work-edit-amount" error={errors.amount?.message}>
              <Input
                id="work-edit-amount"
                type="number"
                min={0}
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Coût réel (€, optionnel)" htmlFor="work-edit-cost" error={errors.actualCost?.message}>
              <Input
                id="work-edit-cost"
                type="number"
                min={0}
                step="0.01"
                {...register("actualCost", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Début" htmlFor="work-edit-date" error={errors.date?.message}>
              <Input id="work-edit-date" type="date" {...register("date")} />
            </FormField>
            <FormField label="Fin prévue (optionnel)" htmlFor="work-edit-end">
              <Input id="work-edit-end" type="date" {...register("endDate")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Statut" htmlFor="work-edit-status" error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="work-edit-status" className="w-full">
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
            <FormField label="Avancement (%, optionnel)" htmlFor="work-edit-progress" error={errors.progress?.message}>
              <Input
                id="work-edit-progress"
                type="number"
                min={0}
                max={100}
                {...register("progress", { valueAsNumber: true })}
              />
            </FormField>
          </div>

          {confirmDelete ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <p className="text-xs text-destructive">
                Supprimer le chantier et sa dépense associée ?
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? "Suppression…" : "Confirmer"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 data-icon="inline-start" />
              Supprimer le chantier
            </Button>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
