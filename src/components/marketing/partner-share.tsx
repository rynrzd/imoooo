"use client";

import * as React from "react";
import { Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Lien de partage + QR code du partenaire. Le QR encode exactement le lien
 * de parrainage : le scanner revient à cliquer le lien (clic tracké par le
 * proxy). Aucune donnée sensible.
 */
export function PartnerShare({
  referralLink,
  qrDataUrl,
}: {
  referralLink: string;
  qrDataUrl: string | null;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Lien copié.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible — copiez le lien manuellement.");
    }
  };

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Votre lien de parrainage</p>
        <div className="flex gap-2">
          <Input readOnly value={referralLink} className="font-mono text-xs" />
          <Button variant="outline" onClick={() => void copy()} className="shrink-0">
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copié" : "Copier"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Partagez ce lien ou le QR code. Chaque visite, inscription et
          abonnement généré vous est automatiquement attribué.
        </p>
      </div>

      {qrDataUrl ? (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR code de votre lien de parrainage"
            width={128}
            height={128}
            className="size-32 rounded-lg border border-border bg-white p-1.5"
          />
          <a
            href={qrDataUrl}
            download="nireo-qr-partenaire.png"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="size-3.5" aria-hidden />
            Télécharger le QR
          </a>
        </div>
      ) : null}
    </div>
  );
}
