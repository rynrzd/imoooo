"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { FormField } from "@/components/shared/form-field";
import { RentReminderButton } from "./rent-reminder-button";
import { formatMonth } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { RentPayment } from "@/lib/types";

const schema = z.object({
  expected: z.number({ message: "Montant requis." }).min(0, "Montant invalide."),
  received: z.number({ message: "Montant requis." }).min(0, "Montant invalide."),
  comment: z.string(),
});

type FormValues = z.infer<typeof schema>;

/** Modification d'une échéance : montants, commentaire — et suppression. */
export function EditPaymentDialog({ payment }: { payment: RentPayment }) {
  const { updatePayment, deletePayment } = useAppStore();
  const [open, setOpen] = React.useState(false);
  // Suppression en deux temps, dans le même dialogue.
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      expected: payment.expected,
      received: payment.received,
      comment: payment.comment,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updatePayment(payment.id, values);
      toast.success("Échéance mise à jour.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    }
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePayment(payment.id);
      toast.success("Échéance supprimée.");
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
          reset({
            expected: payment.expected,
            received: payment.received,
            comment: payment.comment,
          });
          setConfirmDelete(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier l'échéance de ${formatMonth(payment.month)}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Loyer de {formatMonth(payment.month)}</DialogTitle>
          <DialogDescription>
            Ajustez les montants ou ajoutez un commentaire — le statut est
            recalculé automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Montant attendu (€)" htmlFor="pay-expected" error={errors.expected?.message}>
              <Input
                id="pay-expected"
                type="number"
                min={0}
                step="0.01"
                {...register("expected", { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Montant reçu (€)" htmlFor="pay-received" error={errors.received?.message}>
              <Input
                id="pay-received"
                type="number"
                min={0}
                step="0.01"
                {...register("received", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <FormField label="Commentaire" htmlFor="pay-comment">
            <Input
              id="pay-comment"
              placeholder="Relance envoyée, accord d'étalement…"
              {...register("comment")}
            />
          </FormField>

          {payment.status === "retard" ? (
            <RentReminderButton payment={payment} />
          ) : null}

          {confirmDelete ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <p className="text-xs text-destructive">
                Supprimer définitivement cette échéance ?
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
              Supprimer l&apos;échéance
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
