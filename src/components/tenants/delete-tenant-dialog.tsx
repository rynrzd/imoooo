"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { tenantFullName } from "@/lib/finance";
import { useAppStore } from "@/lib/store";
import type { Tenant } from "@/lib/types";

/** Suppression d'un bail (et de ses échéances) avec confirmation explicite. */
export function DeleteTenantDialog({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const { deleteTenant } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const active = tenant.exitDate === null;

  const handleDelete = async () => {
    setPending(true);
    try {
      await deleteTenant(tenant.id);
      toast.success(`Bail de ${tenantFullName(tenant)} supprimé.`);
      router.replace("/locataires");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 data-icon="inline-start" />
        Supprimer
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Supprimer le bail de {tenantFullName(tenant)} ?</DialogTitle>
          <DialogDescription>
            Cette action est définitive : le bail, l&apos;historique des loyers et la
            fiche du locataire seront supprimés.
            {active ? " Le logement repassera en « Vacant »." : ""}
            {" "}Pour conserver l&apos;historique, préférez « Terminer le bail ».
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
