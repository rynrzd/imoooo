"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

async function postPayout(payload: Record<string, unknown>): Promise<{ ok: boolean; message?: string; error?: string }> {
  const response = await fetch("/api/admin/marketing/payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await response.json()) as { ok: boolean; message?: string; error?: string };
}

/**
 * Création d'un relevé de paiement : partenaire + période. Le serveur
 * rattache les commissions PAYABLES de la période et calcule le total —
 * le navigateur ne calcule aucun montant.
 */
export function PayoutCreateDialog({
  partners,
}: {
  partners: { id: string; name: string; payableCents: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const withPayable = partners.filter((p) => p.payableCents > 0);

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const [partnerId, setPartnerId] = React.useState(withPayable[0]?.id ?? "");
  const [periodStart, setPeriodStart] = React.useState(firstOfMonth.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = React.useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");

  const submit = async () => {
    if (pending) return;
    if (!partnerId) return void toast.error("Choisissez un partenaire.");
    setPending(true);
    try {
      const result = await postPayout({ action: "create", partnerId, periodStart, periodEnd, notes });
      if (result.ok) {
        toast.success(result.message ?? "Relevé créé.");
        setOpen(false);
        setNotes("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Création impossible.");
      }
    } catch {
      toast.error("Création impossible. Vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Nouveau relevé de paiement</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau relevé de paiement</DialogTitle>
          <DialogDescription>
            Le total est calculé côté serveur à partir des commissions disponibles de la période.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="payout-partner">Partenaire</Label>
            <select id="payout-partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={SELECT_CLASS}>
              {withPayable.length === 0 ? (
                <option value="">Aucun partenaire avec des commissions disponibles</option>
              ) : (
                withPayable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {(p.payableCents / 100).toFixed(2).replace(".", ",")} € disponibles
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payout-start">Du</Label>
              <Input id="payout-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-end">Au</Label>
              <Input id="payout-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payout-notes">Note (facultative)</Label>
            <Input id="payout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. Commissions de juillet" />
          </div>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={pending || withPayable.length === 0}>
            {pending ? "Création…" : "Créer le relevé"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Marque un relevé « payé » APRÈS le virement manuel : méthode obligatoire,
 * référence et note optionnelles. Le passage à payé est atomique côté
 * serveur (relevé + commissions), un relevé déjà payé est refusé.
 */
export function PayoutMarkPaidDialog({ payoutId, amountLabel }: { payoutId: string; amountLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [method, setMethod] = React.useState("Virement SEPA");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const submit = async () => {
    if (pending) return;
    if (!method.trim()) return void toast.error("Indiquez la méthode de paiement.");
    setPending(true);
    try {
      const result = await postPayout({
        action: "mark_paid",
        payoutId,
        paymentMethod: method,
        paymentReference: reference,
        notes,
      });
      if (result.ok) {
        toast.success(result.message ?? "Relevé payé.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Marquer payé</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marquer le relevé comme payé</DialogTitle>
          <DialogDescription>
            À faire APRÈS le virement de {amountLabel}. Les commissions liées passeront à « payée ».
            Un relevé déjà payé ne peut pas être repayé.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-method">Méthode de paiement *</Label>
            <Input id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Virement SEPA, PayPal…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Référence du virement</Label>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. VIR-2026-07-0001" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Note</Label>
            <Input id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facultative" />
          </div>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Enregistrement…" : "Confirmer le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
