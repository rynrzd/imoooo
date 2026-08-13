"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/form/confirm-destructive";
import { tenantFullName } from "@/lib/finance";
import { useAppStore } from "@/lib/store";
import type { Tenant } from "@/lib/types";

/**
 * Suppression d'un bail — confirmation partagée.
 *
 * La confirmation rappelle qu'il existe une alternative NON destructive :
 * terminer le bail conserve tout l'historique et libère quand même le
 * logement. Supprimer, c'est effacer.
 */
export function DeleteTenantDialog({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const { data, deleteTenant } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const active = tenant.exitDate === null;

  const payments = data.rentPayments.filter((p) => p.tenantId === tenant.id);
  const property = data.properties.find((p) => p.id === tenant.propertyId);

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" />
        Supprimer
      </Button>

      <ConfirmDestructive
        open={open}
        onOpenChange={setOpen}
        title="Supprimer ce bail ?"
        target={`${tenantFullName(tenant)}${property ? ` — ${property.name}` : ""}`}
        consequences={[
          "La fiche du locataire, si elle n'a aucun autre bail",
          payments.length > 0
            ? `${payments.length} échéance${payments.length > 1 ? "s" : ""} de loyer et leur historique`
            : "Aucune échéance enregistrée",
          ...(active ? ["Le logement repassera en « Vacant »"] : []),
        ]}
        preserved={[
          "Les documents du logement (bail signé, état des lieux…)",
          "Les dépenses et les travaux du logement",
        ]}
        confirmLabel="Supprimer le bail"
        onConfirm={async () => {
          await deleteTenant(tenant.id);
          toast.success(`Bail de ${tenantFullName(tenant)} supprimé.`);
          router.replace("/locataires");
        }}
      />
    </>
  );
}
