"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimRepairAction } from "@/features/nireo-id/actions/repairs";

/**
 * Prise en charge d'une intervention à partir du lien du client.
 * Le jeton n'ouvre l'accès qu'à CETTE intervention, et seulement tant
 * qu'il n'a pas expiré.
 */
export function RepairClaim({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const claim = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("token", token);
    const result = await claimRepairAction(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    router.push(`/id/pro/interventions/${result.data.order_id}`);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Button onClick={claim} disabled={pending} data-touch>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Ouverture…
          </>
        ) : (
          "Ouvrir l’intervention"
        )}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-[var(--nid-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
