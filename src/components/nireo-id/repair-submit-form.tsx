"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PARTS_TYPES, PARTS_TYPE_LABELS } from "@/features/nireo-id/constants";
import { submitRepairAction } from "@/features/nireo-id/actions/repairs";
import type { RepairOrderRow } from "@/features/nireo-id/types";

/**
 * Formulaire d'intervention de l'atelier.
 *
 * Écran volontairement simple : ce n'est ni une caisse, ni un ERP. Le
 * client valide ensuite ; l'événement n'est « attesté » que si l'identité
 * professionnelle est approuvée (décision prise côté base).
 */
export function RepairSubmitForm({
  order,
  attestable,
}: {
  order: RepairOrderRow;
  attestable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    form.set("order_id", order.id);
    const result = await submitRepairAction(form);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Intervention transmise au client pour validation.");
    router.refresh();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={submit} className="nid-panel space-y-4 rounded-2xl p-5" noValidate>
      <div>
        <Label htmlFor="visual_state">État visuel avant intervention</Label>
        <textarea
          id="visual_state"
          name="visual_state"
          rows={2}
          maxLength={1000}
          defaultValue={order.visual_state}
          className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
        />
      </div>

      <div>
        <Label htmlFor="diagnosis">Diagnostic</Label>
        <textarea
          id="diagnosis"
          name="diagnosis"
          rows={3}
          required
          minLength={3}
          maxLength={2000}
          defaultValue={order.diagnosis}
          className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
        />
      </div>

      <div>
        <Label htmlFor="operation">Opération effectuée</Label>
        <textarea
          id="operation"
          name="operation"
          rows={3}
          required
          minLength={3}
          maxLength={2000}
          defaultValue={order.operation}
          className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="parts">Pièces remplacées</Label>
          <Input
            id="parts"
            name="parts"
            maxLength={500}
            defaultValue={order.parts}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="parts_type">Type des pièces</Label>
          <select
            id="parts_type"
            name="parts_type"
            defaultValue={order.parts_type}
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
          >
            {PARTS_TYPES.map((type) => (
              <option key={type} value={type}>
                {PARTS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="amount_euros">Montant (€)</Label>
          <Input
            id="amount_euros"
            name="amount_euros"
            type="number"
            min={0}
            step="0.01"
            defaultValue={order.amount_cents === null ? "" : order.amount_cents / 100}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="warranty_months">Garantie de l’intervention (mois)</Label>
          <Input
            id="warranty_months"
            name="warranty_months"
            type="number"
            min={0}
            max={120}
            defaultValue={order.warranty_months ?? ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="intervened_on">Date de l’intervention</Label>
          <Input
            id="intervened_on"
            name="intervened_on"
            type="date"
            defaultValue={order.intervened_on ?? today}
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="comment">Commentaire pour le client</Label>
        <textarea
          id="comment"
          name="comment"
          rows={2}
          maxLength={1000}
          defaultValue={order.comment}
          className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {attestable
          ? "Après validation du client, cette intervention apparaîtra comme « Attestée par un réparateur »."
          : "Votre identité professionnelle n’est pas approuvée : l’intervention apparaîtra comme « Intervention déclarée par l’atelier »."}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-[var(--nid-danger)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" data-touch disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Envoi…
          </>
        ) : (
          "Envoyer au client pour validation"
        )}
      </Button>
    </form>
  );
}
