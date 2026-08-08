"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/features/nireo-id/types";

/**
 * Décision administrative avec MOTIF OBLIGATOIRE.
 * Le formulaire refuse d'envoyer sans motif : la trace d'audit doit
 * toujours pouvoir expliquer pourquoi une décision a été prise.
 */
interface Option {
  value: string;
  label: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  confirm?: string;
}

export function AdminDecisionForm({
  action,
  idField,
  idValue,
  reasonField,
  reasonLabel,
  options,
  extraCheckbox,
  successMessage,
}: {
  action: (form: FormData) => Promise<ActionResult<unknown>>;
  idField: string;
  idValue: string;
  reasonField: string;
  reasonLabel: string;
  options: Option[];
  extraCheckbox?: { name: string; label: string };
  successMessage: string;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [extra, setExtra] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);

  const decide = async (option: Option) => {
    if (pending) return;
    if (reason.trim().length < 5) {
      toast.error("Le motif est obligatoire (5 caractères minimum).");
      return;
    }
    if (option.confirm && !window.confirm(option.confirm)) return;

    setPending(option.value);
    const form = new FormData();
    form.set(idField, idValue);
    form.set("decision", option.value);
    form.set(reasonField, reason);
    if (extraCheckbox) form.set(extraCheckbox.name, extra ? "true" : "false");

    const result = await action(form);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(successMessage);
    setReason("");
    router.refresh();
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`reason-${idValue}`}>{reasonLabel} *</Label>
        <textarea
          id={`reason-${idValue}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={500}
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {extraCheckbox ? (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={extra}
            onChange={(event) => setExtra(event.target.checked)}
            className="size-4 rounded border-input"
          />
          {extraCheckbox.label}
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={option.variant ?? "outline"}
            onClick={() => decide(option)}
            disabled={pending !== null}
          >
            {pending === option.value ? (
              <>
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                Traitement…
              </>
            ) : (
              option.label
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
