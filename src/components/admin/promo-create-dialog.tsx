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
import type { ActionResult } from "@/lib/admin/types";

export interface PromoFormValues {
  code: string;
  description: string;
  discountType: "percent" | "amount";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
  appliesToPlans: string[];
  maxRedemptions: number | null;
  oncePerCustomer: boolean;
  startsAt: string | null;
  expiresAt: string | null;
}

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const PLAN_CHOICES = [
  { id: "starter", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business+" },
] as const;

/** Création d'un code promo — la création réelle (Stripe) est serveur. */
export function PromoCreateDialog({
  action,
}: {
  action: (input: PromoFormValues) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [discountType, setDiscountType] = React.useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = React.useState("");
  const [duration, setDuration] = React.useState<"once" | "repeating" | "forever">("once");
  const [durationMonths, setDurationMonths] = React.useState("");
  const [plans, setPlans] = React.useState<string[]>([]);
  const [maxRedemptions, setMaxRedemptions] = React.useState("");
  const [oncePerCustomer, setOncePerCustomer] = React.useState(false);
  const [startsAt, setStartsAt] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

  const togglePlan = (id: string) => {
    setPlans((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const submit = () => {
    const value = Number(discountValue.replace(",", "."));
    if (!code.trim()) return toast.error("Indiquez le code.");
    if (!Number.isFinite(value) || value <= 0) return toast.error("Valeur de réduction invalide.");
    startTransition(async () => {
      const result = await action({
        code: code.trim().toUpperCase(),
        description,
        discountType,
        discountValue: value,
        duration,
        durationMonths: durationMonths ? Number(durationMonths) : null,
        appliesToPlans: plans,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        oncePerCustomer,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (result.ok) {
        toast.success(result.message ?? "Code créé.");
        setOpen(false);
        setCode("");
        setDescription("");
        setDiscountValue("");
        setPlans([]);
        setMaxRedemptions("");
        setStartsAt("");
        setExpiresAt("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Créer un code promo</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau code promo</DialogTitle>
          <DialogDescription>
            Le coupon est créé côté serveur (via Stripe s&apos;il est connecté).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BIENVENUE20"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-desc">Description interne</Label>
              <Input
                id="promo-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionnelle"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-type">Type de réduction</Label>
              <select
                id="promo-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
                className={SELECT_CLASS}
              >
                <option value="percent">Pourcentage (%)</option>
                <option value="amount">Montant fixe (€)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-value">
                {discountType === "percent" ? "Pourcentage" : "Montant (€)"}
              </Label>
              <Input
                id="promo-value"
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "20" : "10"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-duration">Durée de la réduction</Label>
              <select
                id="promo-duration"
                value={duration}
                onChange={(e) =>
                  setDuration(e.target.value as "once" | "repeating" | "forever")
                }
                className={SELECT_CLASS}
              >
                <option value="once">Une seule échéance</option>
                <option value="repeating">Plusieurs mois</option>
                <option value="forever">Permanente</option>
              </select>
            </div>
            {duration === "repeating" ? (
              <div className="space-y-1.5">
                <Label htmlFor="promo-months">Nombre de mois</Label>
                <Input
                  id="promo-months"
                  inputMode="numeric"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  placeholder="3"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="promo-max">Utilisations max.</Label>
                <Input
                  id="promo-max"
                  inputMode="numeric"
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  placeholder="Illimité"
                />
              </div>
            )}
          </div>
          {duration === "repeating" ? (
            <div className="space-y-1.5">
              <Label htmlFor="promo-max2">Utilisations max.</Label>
              <Input
                id="promo-max2"
                inputMode="numeric"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Illimité"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Plans concernés</Label>
            <div className="flex flex-wrap gap-3">
              {PLAN_CHOICES.map((plan) => (
                <label key={plan.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={plans.includes(plan.id)}
                    onChange={() => togglePlan(plan.id)}
                    className="size-4 rounded border-border"
                  />
                  {plan.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Aucune case cochée = tous les plans payants.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">Début (indicatif)</Label>
              <Input
                id="promo-start"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">Expiration</Label>
              <Input
                id="promo-end"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={oncePerCustomer}
              onChange={(e) => setOncePerCustomer(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Réservé à la première transaction d&apos;un client (pas de cumul)
          </label>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Création…" : "Créer le code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
