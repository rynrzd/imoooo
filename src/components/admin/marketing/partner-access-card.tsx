"use client";

import * as React from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Lien d'accès CONFIDENTIEL au tableau de bord self-service du partenaire.
 * Contient le jeton secret : à communiquer au partenaire uniquement (jamais
 * publié). Ouvrir ce lien connecte automatiquement le partenaire à son espace.
 */
export function PartnerAccessCard({ accessUrl }: { accessUrl: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accessUrl);
      setCopied(true);
      toast.success("Lien d'accès copié.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Accès au tableau de bord partenaire</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Lien confidentiel (contient un jeton secret) : communiquez-le au
        partenaire pour qu&apos;il consulte ses statistiques et commissions. Ne
        le publiez jamais.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={accessUrl} className="font-mono text-xs" />
        <Button variant="outline" size="sm" onClick={() => void copy()} className="shrink-0">
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
}
