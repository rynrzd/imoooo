"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Carte « Lien public de la vitrine » — affichée dans /admin/entreprise.
 * Donne un lien PUBLIC (accessible sans connexion) à partager aux entreprises,
 * avec copie en un clic et ouverture dans un nouvel onglet.
 */
export function VitrineLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié dans le presse-papiers.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copie automatique impossible — sélectionnez le lien puis Ctrl/Cmd + C.");
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Globe className="size-4 text-primary" /> Lien public de votre vitrine
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Accessible sans connexion. Partagez-le aux entreprises : elles verront la vitrine directement.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Lien public de la vitrine"
          className="min-w-0 flex-1 truncate rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
        />
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button type="button" render={<a href={url} target="_blank" rel="noreferrer" />}>
            Ouvrir <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
