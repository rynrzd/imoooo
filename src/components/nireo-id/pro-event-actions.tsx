"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { revokeProEventAction } from "@/features/nireo-id/actions/professional";

/**
 * Correction traçable d'une intervention professionnelle.
 * L'événement reste dans l'historique, marqué « Révoqué » avec son motif ;
 * une nouvelle intervention peut ensuite être enregistrée.
 */
export function ProEventActions({ assetId, eventId }: { assetId: string; eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    if (pending) return;
    setPending(true);
    const form = new FormData();
    form.set("event_id", eventId);
    form.set("asset_id", assetId);
    form.set("reason", reason);
    const result = await revokeProEventAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Intervention révoquée : la correction est tracée.");
    setOpen(false);
    setReason("");
    router.refresh();
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" data-icon="inline-start" />
        Révoquer cette intervention
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/50 p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`pro-reason-${eventId}`}>Motif de la révocation</Label>
        <textarea
          id={`pro-reason-${eventId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ex. erreur de référence de pièce, intervention saisie sur le mauvais appareil…"
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submit} disabled={pending || reason.trim().length < 5}>
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Envoi…
            </>
          ) : (
            "Confirmer la révocation"
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
