"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/admin/types";

/** Modification de la description interne d'un code promo. */
export function PromoDescriptionForm({
  initial,
  action,
}: {
  initial: string;
  action: (description: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await action(value);
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="promo-description">Description interne</Label>
      <div className="flex gap-2">
        <Input
          id="promo-description"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex. campagne de lancement"
        />
        <Button variant="outline" size="sm" onClick={submit} disabled={pending} className="h-8">
          {pending ? "…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
