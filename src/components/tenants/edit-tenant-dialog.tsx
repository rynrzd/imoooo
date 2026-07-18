"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
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
import { useAppStore } from "@/lib/store";
import type { Tenant } from "@/lib/types";

const schema = z.object({
  firstName: z.string().min(2, "Prénom requis."),
  lastName: z.string().min(2, "Nom requis."),
  email: z.string().email("E-mail invalide."),
  phone: z.string().min(10, "Téléphone requis."),
  entryDate: z.string().min(1, "Date d'entrée requise."),
  rent: z.number({ message: "Loyer requis." }).positive("Loyer invalide."),
  charges: z.number({ message: "Charges requises." }).min(0, "Charges invalides."),
  deposit: z.number({ message: "Dépôt requis." }).min(0, "Dépôt invalide."),
});

type FormValues = z.infer<typeof schema>;

/** Modification d'un locataire et des conditions de son bail. */
export function EditTenantDialog({ tenant }: { tenant: Tenant }) {
  const { updateTenant } = useAppStore();
  const [open, setOpen] = React.useState(false);

  const defaults: FormValues = {
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email,
    phone: tenant.phone,
    entryDate: tenant.entryDate,
    rent: tenant.rent,
    charges: tenant.charges,
    deposit: tenant.deposit,
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateTenant(tenant.id, values);
      toast.success("Locataire mis à jour.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil data-icon="inline-start" />
        Modifier
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le locataire</DialogTitle>
          <DialogDescription>
            Coordonnées et conditions du bail — les échéances futures utiliseront
            le nouveau loyer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prénom" htmlFor="et-first" error={errors.firstName?.message}>
              <Input id="et-first" {...register("firstName")} />
            </FormField>
            <FormField label="Nom" htmlFor="et-last" error={errors.lastName?.message}>
              <Input id="et-last" {...register("lastName")} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="E-mail" htmlFor="et-email" error={errors.email?.message}>
              <Input id="et-email" type="email" {...register("email")} />
            </FormField>
            <FormField label="Téléphone" htmlFor="et-phone" error={errors.phone?.message}>
              <Input id="et-phone" type="tel" {...register("phone")} />
            </FormField>
          </div>
          <FormField label="Date d'entrée" htmlFor="et-entry" error={errors.entryDate?.message}>
            <Input id="et-entry" type="date" {...register("entryDate")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FormField label="Loyer (€)" htmlFor="et-rent" error={errors.rent?.message}>
              <Input id="et-rent" type="number" min={0} {...register("rent", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Charges (€)" htmlFor="et-charges" error={errors.charges?.message}>
              <Input id="et-charges" type="number" min={0} {...register("charges", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Dépôt (€)" htmlFor="et-deposit" error={errors.deposit?.message}>
              <Input id="et-deposit" type="number" min={0} {...register("deposit", { valueAsNumber: true })} />
            </FormField>
          </div>
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
