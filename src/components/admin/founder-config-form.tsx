"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/admin/types";

/** Configuration de l'offre Fondateur (activation + places, max 100). */
export function FounderConfigForm({
  enabled,
  maxPlaces,
  action,
}: {
  enabled: boolean;
  maxPlaces: number;
  action: (enabled: boolean, maxPlaces: number) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = React.useState(enabled);
  const [places, setPlaces] = React.useState(String(maxPlaces));
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    const parsed = Number(places);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Le nombre de places doit être compris entre 0 et 100.");
      return;
    }
    startTransition(async () => {
      const result = await action(isEnabled, parsed);
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">Offre Fondateur active (achat possible)</span>
        <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="founder-places">Nombre maximal de places (100 max)</Label>
        <Input
          id="founder-places"
          inputMode="numeric"
          value={places}
          onChange={(e) => setPlaces(e.target.value)}
          className="w-32"
        />
      </div>
      <Button variant="outline" size="sm" onClick={submit} disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
