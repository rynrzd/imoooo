"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { formatCurrency, formatMonth } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { RentPayment } from "@/lib/types";

const schema = z.object({
  amount: z
    .number({ message: "Montant requis." })
    .positive("Le montant doit être positif."),
});

type FormValues = z.infer<typeof schema>;

interface RecordPaymentDialogProps {
  payment: RentPayment;
  /** Libellé du déclencheur (par défaut « Encaisser »). */
  triggerLabel?: string;
  /** Style du déclencheur. */
  triggerVariant?: "outline" | "default";
}

/** Encaissement local d'un loyer (total ou partiel). */
export function RecordPaymentDialog({
  payment,
  triggerLabel = "Encaisser",
  triggerVariant = "outline",
}: RecordPaymentDialogProps) {
  const { markRentPaid } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const remaining = payment.expected - payment.received;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: remaining },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await markRentPaid(payment.id, values.amount);
      toast.success(`Paiement de ${formatCurrency(values.amount)} enregistré.`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ amount: remaining });
      }}
    >
      <DialogTrigger render={<Button size="sm" variant={triggerVariant} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Loyer de {formatMonth(payment.month)} — reste dû :{" "}
            {formatCurrency(remaining)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Montant reçu (€)" htmlFor="amount" error={errors.amount?.message}>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={0}
              {...register("amount", { valueAsNumber: true })}
            />
          </FormField>
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
