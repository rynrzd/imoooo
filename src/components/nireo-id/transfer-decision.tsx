"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptTransferAction,
  declineTransferAction,
} from "@/features/nireo-id/actions/owner";

/**
 * Acceptation ou refus d'un transfert.
 *
 * L'opération est atomique côté base : un double clic (ou un second
 * onglet) ne peut pas transférer deux fois — la seconde tentative reçoit
 * « déjà traité ».
 */
export function TransferDecision({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"accept" | "decline" | null>(null);

  const accept = async () => {
    if (pending) return;
    setPending("accept");
    const form = new FormData();
    form.set("token", token);
    const result = await acceptTransferAction(form);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Passeport transféré : il figure désormais dans vos objets.");
    router.push(`/id/app/objets/${result.data.asset_id}`);
    router.refresh();
  };

  const decline = async () => {
    if (pending) return;
    if (!window.confirm("Refuser ce transfert ? Le vendeur en sera informé dans son espace.")) {
      return;
    }
    setPending("decline");
    const form = new FormData();
    form.set("token", token);
    const result = await declineTransferAction(form);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Transfert refusé.");
    router.push("/id/app/transferts");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button data-touch onClick={accept} disabled={pending !== null}>
        {pending === "accept" ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Transfert en cours…
          </>
        ) : (
          <>
            <Check className="size-4" data-icon="inline-start" />
            Accepter le transfert
          </>
        )}
      </Button>
      <Button variant="outline" data-touch onClick={decline} disabled={pending !== null}>
        {pending === "decline" ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Refus…
          </>
        ) : (
          <>
            <X className="size-4" data-icon="inline-start" />
            Refuser
          </>
        )}
      </Button>
    </div>
  );
}
