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
import type { VariantProps } from "class-variance-authority";

/**
 * Bouton d'action du module Marketing : envoie l'action à une route API
 * admin sécurisée (rôle vérifié EN BASE côté serveur, audit journalisé).
 * Le navigateur ne calcule RIEN : il transmet l'intention, le serveur
 * décide. Avec `title`, une confirmation est exigée ; avec `withReason`,
 * une raison est demandée (obligatoire si `reasonRequired`).
 */
export function MarketingAction({
  endpoint,
  payload,
  label,
  title,
  description,
  confirmLabel = "Confirmer",
  variant = "outline",
  size = "sm",
  withReason = false,
  reasonRequired = false,
  reasonLabel = "Raison (journalisée)",
  requiredPhrase,
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  label: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  withReason?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  requiredPhrase?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [phrase, setPhrase] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const blocked =
    (Boolean(requiredPhrase) && phrase !== requiredPhrase) ||
    (reasonRequired && reason.trim().length === 0);

  const run = async () => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, reason: reason.trim() }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (response.ok && result.ok) {
        toast.success(result.message ?? "Action effectuée.");
        setOpen(false);
        setReason("");
        setPhrase("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Action impossible. Réessayez.");
      }
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  };

  // Action directe, sans dialogue de confirmation.
  if (!title) {
    return (
      <Button variant={variant} size={size} onClick={run} disabled={pending}>
        {pending ? "En cours…" : label}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-3">
          {withReason ? (
            <div className="space-y-1.5">
              <Label htmlFor="marketing-action-reason">{reasonLabel}</Label>
              <Input
                id="marketing-action-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonRequired ? "Obligatoire" : "Optionnel"}
              />
            </div>
          ) : null}
          {requiredPhrase ? (
            <div className="space-y-1.5">
              <Label htmlFor="marketing-action-phrase">
                Saisissez «&nbsp;{requiredPhrase}&nbsp;» pour confirmer
              </Label>
              <Input
                id="marketing-action-phrase"
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
