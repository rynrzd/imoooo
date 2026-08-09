"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/features/nireo-id/actions/workspace";

/** Acceptation d'une invitation — idempotente, sans succès simulé. */
export function InviteDecision({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("token", token);
    const result = await acceptInviteAction(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Vous avez rejoint l’espace.");
    router.push(`/id/entreprise/${result.data.workspace_id}`);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Button onClick={accept} disabled={pending} data-touch>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Traitement…
          </>
        ) : (
          "Accepter l’invitation"
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
