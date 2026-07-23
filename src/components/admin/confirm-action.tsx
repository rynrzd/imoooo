"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type buttonVariants } from "@/components/ui/button";
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
import type { ActionResult } from "@/lib/admin/types";
import type { VariantProps } from "class-variance-authority";

/**
 * Bouton + dialogue de confirmation pour les actions administratives
 * sensibles. L'action reçue est une Server Action (déjà liée à sa cible) :
 * la vérification du rôle et l'audit se font côté serveur, jamais ici.
 */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel = "Confirmer",
  variant = "outline",
  size = "sm",
  requiredPhrase,
  withReason = false,
  reasonLabel = "Raison (journalisée)",
  action,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  /** Phrase exacte à recopier pour débloquer la confirmation. */
  requiredPhrase?: string;
  withReason?: boolean;
  reasonLabel?: string;
  action: (reason: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const blocked = Boolean(requiredPhrase) && phrase !== requiredPhrase;

  const run = () => {
    if (blocked || pending) return;
    startTransition(async () => {
      try {
        const result = await action(reason.trim());
        if (result.ok) {
          toast.success(result.message ?? "Action effectuée.");
          setOpen(false);
          setPhrase("");
          setReason("");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Action impossible. Réessayez.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {withReason ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-reason">{reasonLabel}</Label>
              <Input
                id="confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          ) : null}
          {requiredPhrase ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-phrase">
                Saisissez «&nbsp;{requiredPhrase}&nbsp;» pour confirmer
              </Label>
              <Input
                id="confirm-phrase"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter showCloseButton>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={run}
            disabled={blocked || pending}
          >
            {pending ? "En cours…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bouton d'action simple (sans dialogue) pour les actions non destructives. */
export function ActionButton({
  label,
  pendingLabel = "En cours…",
  variant = "outline",
  size = "sm",
  action,
}: {
  label: string;
  pendingLabel?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  action: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const run = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? "Action effectuée.");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Action impossible. Réessayez.");
      }
    });
  };

  return (
    <Button variant={variant} size={size} onClick={run} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
