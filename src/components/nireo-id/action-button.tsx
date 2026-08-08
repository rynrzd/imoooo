"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/features/nireo-id/types";

/**
 * Bouton qui déclenche une Server Action réelle.
 *
 * L'état de chargement est affiché, le résultat vient du serveur, et le
 * message de succès n'apparaît QUE si le serveur a confirmé. Une action
 * destructive demande une confirmation explicite.
 */
interface ActionButtonProps {
  action: (form: FormData) => Promise<ActionResult<unknown>>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  successMessage?: string;
  confirmMessage?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  icon?: React.ReactNode;
  onDone?: () => void;
}

export function ActionButton({
  action,
  fields,
  label,
  pendingLabel = "Traitement…",
  successMessage,
  confirmMessage,
  variant = "outline",
  size = "sm",
  className,
  icon,
  onDone,
}: ActionButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = async () => {
    if (pending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    const result = await action(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (successMessage) toast.success(successMessage);
    onDone?.();
    router.refresh();
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={run} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          {pendingLabel}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </Button>
  );
}
