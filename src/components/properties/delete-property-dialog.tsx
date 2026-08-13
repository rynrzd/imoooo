"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/form/confirm-destructive";
import { useAppStore } from "@/lib/store";
import type { Property } from "@/lib/types";

/**
 * Suppression d'un logement — confirmation partagée.
 *
 * Les conséquences ne sont plus une phrase vague : elles sont COMPTÉES sur les
 * données réelles du logement. Quelqu'un qui va perdre onze documents doit
 * voir « 11 documents », pas « les documents associés ».
 *
 * Aucune cascade n'est déclenchée à la main : c'est la base qui supprime les
 * lignes liées (`on delete cascade`), et le store ne retire ensuite les
 * fichiers Storage qu'après le succès de la suppression.
 */
export function DeletePropertyDialog({ property }: { property: Property }) {
  const router = useRouter();
  const { data, deleteProperty } = useAppStore();
  const [open, setOpen] = React.useState(false);

  const leases = data.tenants.filter((t) => t.propertyId === property.id);
  const payments = data.rentPayments.filter(
    (p) => p.propertyId === property.id
  );
  const documents = data.documents.filter((d) => d.propertyId === property.id);
  const photos = data.photos.filter((p) => p.propertyId === property.id);
  const expenses = data.expenses.filter((e) => e.propertyId === property.id);
  const works = data.works.filter((w) => w.propertyId === property.id);

  const consequences = [
    plural(leases.length, "bail", "baux"),
    plural(payments.length, "échéance de loyer", "échéances de loyer"),
    plural(documents.length, "document", "documents"),
    plural(photos.length, "photo", "photos"),
    plural(expenses.length, "dépense", "dépenses"),
    plural(works.length, "chantier", "chantiers"),
  ].filter((line): line is string => line !== null);

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" />
        Supprimer
      </Button>

      <ConfirmDestructive
        open={open}
        onOpenChange={setOpen}
        title="Supprimer ce logement ?"
        target={property.name}
        consequences={
          consequences.length > 0
            ? consequences
            : ["Rien d'autre n'est rattaché à ce logement."]
        }
        preserved={["Vos autres logements et leurs données."]}
        onConfirm={async () => {
          await deleteProperty(property.id);
          toast.success(`${property.name} supprimé.`);
          router.replace("/logements");
        }}
      />
    </>
  );
}

/** « 3 documents », ou rien du tout s'il n'y en a aucun. */
function plural(count: number, one: string, many: string): string | null {
  if (count === 0) return null;
  return `${count} ${count > 1 ? many : one}`;
}
