"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reportDisputeAction, revokeEventAction } from "@/features/nireo-id/actions/owner";
import { DISPUTE_REASONS, DISPUTE_REASON_LABELS, type DisputeReason } from "@/features/nireo-id/constants";

/**
 * Corrections d'un événement.
 *
 * Un événement n'est jamais supprimé : soit le propriétaire révoque sa
 * propre déclaration avec un motif, soit il signale une information qu'il
 * conteste — l'équipe Nireo tranche alors, avec trace d'audit.
 */
export function EventActions({
  assetId,
  eventId,
  canRevoke,
}: {
  assetId: string;
  eventId: string;
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"none" | "revoke" | "report">("none");
  const [reason, setReason] = React.useState("");
  const [disputeReason, setDisputeReason] = React.useState<DisputeReason>("information_inexacte");
  const [pending, setPending] = React.useState(false);

  const submitRevoke = async () => {
    if (pending) return;
    setPending(true);
    const form = new FormData();
    form.set("event_id", eventId);
    form.set("asset_id", assetId);
    form.set("reason", reason);
    const result = await revokeEventAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Événement révoqué : il reste visible, marqué comme retiré.");
    setMode("none");
    setReason("");
    router.refresh();
  };

  const submitReport = async () => {
    if (pending) return;
    setPending(true);
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("event_id", eventId);
    form.set("reason", disputeReason);
    form.set("description", reason);
    const result = await reportDisputeAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Signalement transmis à l'équipe Nireo.");
    setMode("none");
    setReason("");
    router.refresh();
  };

  if (mode === "none") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {canRevoke ? (
          <Button variant="ghost" size="sm" onClick={() => setMode("revoke")}>
            <Undo2 className="size-3.5" data-icon="inline-start" />
            Corriger
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setMode("report")}>
          <Flag className="size-3.5" data-icon="inline-start" />
          Signaler
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/50 p-3">
      {mode === "report" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`dispute-reason-${eventId}`}>Motif</Label>
          <select
            id={`dispute-reason-${eventId}`}
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value as DisputeReason)}
            className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {DISPUTE_REASONS.map((value) => (
              <option key={value} value={value}>
                {DISPUTE_REASON_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`reason-${eventId}`}>
          {mode === "revoke" ? "Motif de la correction" : "Ce que vous contestez"}
        </Label>
        <textarea
          id={`reason-${eventId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={mode === "revoke" ? 500 : 2000}
          placeholder={
            mode === "revoke"
              ? "Ex. date erronée, doublon avec l'événement du 12 mars…"
              : "Décrivez précisément l'anomalie constatée."
          }
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          {mode === "revoke"
            ? "L'événement restera visible, marqué « Révoqué », avec ce motif."
            : "Le signalement est transmis à l'équipe Nireo ; l'information peut être marquée « Contestée »."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={mode === "revoke" ? submitRevoke : submitReport}
          disabled={pending || reason.trim().length < 5}
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              Envoi…
            </>
          ) : mode === "revoke" ? (
            "Révoquer l'événement"
          ) : (
            "Envoyer le signalement"
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMode("none")} disabled={pending}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
