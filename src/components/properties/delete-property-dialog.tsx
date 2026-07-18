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
import { useAppStore } from "@/lib/store";
import type { Property } from "@/lib/types";

/** Suppression d'un logement avec confirmation explicite. */
export function DeletePropertyDialog({ property }: { property: Property }) {
  const router = useRouter();
  const { deleteProperty } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      await deleteProperty(property.id);
      toast.success(`${property.name} supprimé.`);
      router.replace("/logements");
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
          <DialogTitle>Supprimer {property.name} ?</DialogTitle>
          <DialogDescription>
            Cette action est définitive : les baux, loyers, dépenses, documents et
            photos associés seront également supprimés.
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
