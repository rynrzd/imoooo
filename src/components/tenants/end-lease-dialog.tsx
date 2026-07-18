"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
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
import { todayISO } from "@/lib/dates";
import { tenantFullName } from "@/lib/finance";
import { useAppStore } from "@/lib/store";
import type { Tenant } from "@/lib/types";

/** Résiliation d'un bail : date de sortie, logement repassé en « vacant ». */
export function EndLeaseDialog({ tenant }: { tenant: Tenant }) {
  const { endLease } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [exitDate, setExitDate] = React.useState(todayISO());
  const [pending, setPending] = React.useState(false);

  const handleEnd = async () => {
    if (!exitDate) {
      toast.error("Choisissez une date de sortie.");
      return;
    }
    setPending(true);
    try {
      await endLease(tenant.id, exitDate);
      toast.success(
        `Bail de ${tenantFullName(tenant)} terminé — le logement est vacant.`
      );
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Résiliation impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setExitDate(todayISO());
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <LogOut data-icon="inline-start" />
        Terminer le bail
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Terminer le bail de {tenantFullName(tenant)} ?</DialogTitle>
          <DialogDescription>
            L&apos;historique (paiements, documents) est conservé. Le logement
            repasse en « Vacant » et pourra accueillir un nouveau locataire.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Date de sortie" htmlFor="lease-exit">
          <Input
            id="lease-exit"
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => void handleEnd()}
          >
            {pending ? "Résiliation…" : "Terminer le bail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
