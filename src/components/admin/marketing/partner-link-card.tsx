"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Lien unique + QR code d'un partenaire, avec actions réelles :
 * copier le lien, ouvrir le lien, télécharger le QR (PNG 1024/2048, SVG).
 * Le QR affiché et téléchargé vient de la route serveur /api/admin/marketing/qr
 * (génération réelle, contenu vérifié = lien du partenaire).
 */
export function PartnerLinkCard({
  partnerId,
  link,
  qrDataUrl,
}: {
  partnerId: string;
  link: string;
  qrDataUrl: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Lien copié.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible. Sélectionnez le lien manuellement.");
    }
  };

  const qrHref = (format: "png" | "svg", size?: number) =>
    `/api/admin/marketing/qr?partner=${encodeURIComponent(partnerId)}&format=${format}${
      size ? `&size=${size}` : ""
    }&download=1`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 items-center justify-center">
          <div className="rounded-lg border border-border bg-white p-2">
            <Image
              src={qrDataUrl}
              alt="QR code du lien partenaire"
              width={132}
              height={132}
              unoptimized
              className="size-[132px]"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Lien unique</p>
            <code className="mt-1 block truncate rounded-md bg-muted px-2.5 py-2 text-sm" title={link}>
              {link}
            </code>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copié" : "Copier le lien"}
            </Button>
            <Button size="sm" variant="outline" render={<a href={link} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink className="size-4" />
              Ouvrir le lien
            </Button>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <QrCode className="size-3.5" /> Télécharger le QR code
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" render={<a href={qrHref("png", 1024)} />}>
                <Download className="size-4" /> PNG
              </Button>
              <Button size="sm" variant="outline" render={<a href={qrHref("png", 2048)} />}>
                <Download className="size-4" /> PNG HD (impression)
              </Button>
              <Button size="sm" variant="outline" render={<a href={qrHref("svg")} />}>
                <Download className="size-4" /> SVG
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
