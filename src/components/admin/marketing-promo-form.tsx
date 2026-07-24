"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MarketingPromo } from "@/lib/admin/settings";
import type { ActionResult } from "@/lib/admin/types";

/**
 * Édition du bloc marketing affiché sur le site (Tarifs + Abonnement).
 * Aperçu en direct — ce que voit le visiteur. Enregistré via Server Action ;
 * la page publique est revalidée automatiquement (aucun code à modifier).
 */
export function MarketingPromoForm({
  initial,
  action,
}: {
  initial: MarketingPromo;
  action: (promo: MarketingPromo) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [promo, setPromo] = React.useState<MarketingPromo>(initial);
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof MarketingPromo>(key: K, value: MarketingPromo[K]) =>
    setPromo((p) => ({ ...p, [key]: value }));

  const dirty = JSON.stringify(promo) !== JSON.stringify(initial);

  const save = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await action(promo);
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const hasContent = promo.title || promo.subtitle || promo.message || promo.code;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Bloc marketing sur le site</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Affiché sur les pages Tarifs et Abonnement. Décochez pour le masquer.
          </p>
        </div>
        <Switch
          checked={promo.enabled}
          onCheckedChange={(checked) => set("enabled", checked)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="promo-title">Titre</Label>
          <Input
            id="promo-title"
            value={promo.title}
            maxLength={120}
            onChange={(e) => set("title", e.target.value)}
            placeholder="🎉 Offre de lancement"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promo-code-field">Code à afficher</Label>
          <Input
            id="promo-code-field"
            value={promo.code}
            maxLength={50}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="BUSINESS20"
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-subtitle">Sous-titre</Label>
        <Input
          id="promo-subtitle"
          value={promo.subtitle}
          maxLength={160}
          onChange={(e) => set("subtitle", e.target.value)}
          placeholder="Pour une durée limitée"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-message">Message</Label>
        <textarea
          id="promo-message"
          value={promo.message}
          rows={2}
          maxLength={500}
          onChange={(e) => set("message", e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          placeholder="Profitez de -20 % sur le plan Business+ avec le code ci-dessous."
        />
      </div>

      {/* Aperçu — rendu identique à ce que voit le visiteur. */}
      {hasContent ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Aperçu</p>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1">
                {promo.title ? <p className="font-semibold text-foreground">{promo.title}</p> : null}
                {promo.subtitle ? (
                  <p className="text-sm text-muted-foreground">{promo.subtitle}</p>
                ) : null}
                {promo.message ? <p className="text-sm text-foreground">{promo.message}</p> : null}
                {promo.code ? (
                  <p className="pt-1 text-sm">
                    Code :{" "}
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono font-semibold text-primary">
                      {promo.code}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Button variant="outline" size="sm" disabled={pending || !dirty} onClick={save}>
        {pending ? "Enregistrement…" : "Enregistrer le bloc marketing"}
      </Button>
    </div>
  );
}
