"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Supports marketing imprimables pour un partenaire — RÉELS et propres :
 * chaque modèle est un SVG vectoriel (QR intégré en data-URL), rendu net à
 * toute taille. Boutons : aperçu (à l'écran), imprimer (dialogue navigateur),
 * télécharger PNG (rasterisé haute résolution) et PDF (via l'impression
 * navigateur → « Enregistrer en PDF », sans dépendance externe).
 *
 * Le QR encode le lien unique du partenaire (vérifié serveur) : le scanner
 * ouvre nireo.fr/?ref=slug et enregistre le clic comme n'importe quelle visite.
 */

type SupportId = "carte" | "flyer" | "comptoir" | "affiche" | "qr";

interface SupportModel {
  id: SupportId;
  name: string;
  description: string;
  /** Dimensions du SVG en px (ratio réel du format). */
  width: number;
  height: number;
}

const MODELS: SupportModel[] = [
  { id: "carte", name: "Carte de visite", description: "85 × 55 mm — format carte de visite", width: 850, height: 550 },
  { id: "flyer", name: "Flyer A5", description: "148 × 210 mm — distribution", width: 1050, height: 1485 },
  { id: "comptoir", name: "Affichage comptoir", description: "100 × 150 mm — chevalet de comptoir", width: 1000, height: 1500 },
  { id: "affiche", name: "Affiche A4", description: "210 × 297 mm — vitrine / mur", width: 1240, height: 1754 },
  { id: "qr", name: "QR code seul", description: "QR + lien court, format carré", width: 1000, height: 1000 },
];

const CTA_TEXT = {
  title: "Vous êtes propriétaire bailleur ?",
  body: "Centralisez vos logements, loyers, documents et locataires avec Nireo.",
  action: "Scannez pour découvrir la plateforme.",
};

const NAVY = "#0f172a";
const BLUE = "#2a78d6";
const MUTED = "#64748b";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Logo Nireo vectoriel simple (pastille + nom). */
function logoMarkup(x: number, y: number, scale: number): string {
  const r = 16 * scale;
  return `
    <g transform="translate(${x} ${y})">
      <rect x="0" y="${-r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.5}" fill="${NAVY}" />
      <path d="M ${r * 0.55} ${r * 0.6} L ${r * 0.55} ${-r * 0.6} L ${r * 1.45} ${r * 0.6} L ${r * 1.45} ${-r * 0.6}"
        fill="none" stroke="#ffffff" stroke-width="${r * 0.28}" stroke-linecap="round" stroke-linejoin="round" />
      <text x="${r * 2 + 12 * scale}" y="${r * 0.6}" font-family="Georgia, 'Times New Roman', serif"
        font-size="${r * 1.5}" font-weight="700" fill="${NAVY}">Nireo</text>
    </g>`;
}

/** Construit le SVG d'un support (chaîne autonome, aucune ressource externe). */
function buildSvg(
  model: SupportModel,
  partnerName: string,
  showName: boolean,
  shortLink: string,
  qrDataUrl: string
): string {
  const { width: w, height: h } = model;
  const link = escapeXml(shortLink);
  const name = escapeXml(partnerName);

  if (model.id === "carte") {
    const qr = 300;
    return svgWrap(w, h, `
      <rect width="${w}" height="${h}" fill="#ffffff" />
      <rect x="0" y="0" width="${w}" height="14" fill="${BLUE}" />
      ${logoMarkup(48, 90, 1)}
      <text x="48" y="200" font-family="Georgia, serif" font-size="40" font-weight="700" fill="${NAVY}">${escapeXml(CTA_TEXT.title)}</text>
      <text x="48" y="250" font-family="Arial, sans-serif" font-size="24" fill="${MUTED}">Logements · loyers · documents · locataires</text>
      <text x="48" y="360" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${BLUE}">${link}</text>
      ${showName && partnerName ? `<text x="48" y="470" font-family="Arial, sans-serif" font-size="22" fill="${MUTED}">Partenaire : ${name}</text>` : ""}
      <image x="${w - qr - 48}" y="${(h - qr) / 2}" width="${qr}" height="${qr}" href="${qrDataUrl}" />
    `);
  }

  if (model.id === "qr") {
    const qr = 620;
    return svgWrap(w, h, `
      <rect width="${w}" height="${h}" fill="#ffffff" />
      <rect x="0" y="0" width="${w}" height="16" fill="${BLUE}" />
      ${logoMarkup(w / 2 - 90, 110, 1.1)}
      <image x="${(w - qr) / 2}" y="200" width="${qr}" height="${qr}" href="${qrDataUrl}" />
      <text x="${w / 2}" y="900" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="${BLUE}">${link}</text>
      ${showName && partnerName ? `<text x="${w / 2}" y="950" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="${MUTED}">${name}</text>` : ""}
    `);
  }

  // Modèles verticaux (flyer, comptoir, affiche) — même composition, mise à l'échelle.
  const qr = Math.round(w * 0.42);
  const titleSize = Math.round(w * 0.058);
  const bodySize = Math.round(w * 0.032);
  const cx = w / 2;
  return svgWrap(w, h, `
    <rect width="${w}" height="${h}" fill="#ffffff" />
    <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.012)}" fill="${BLUE}" />
    ${logoMarkup(cx - w * 0.11, h * 0.11, w / 850)}
    <text x="${cx}" y="${h * 0.26}" text-anchor="middle" font-family="Georgia, serif" font-size="${titleSize}" font-weight="700" fill="${NAVY}">${escapeXml(CTA_TEXT.title)}</text>
    ${wrapText(CTA_TEXT.body, cx, h * 0.32, bodySize, Math.floor(w / (bodySize * 0.52)), MUTED, "Arial, sans-serif")}
    <image x="${(w - qr) / 2}" y="${h * 0.44}" width="${qr}" height="${qr}" href="${qrDataUrl}" />
    <text x="${cx}" y="${h * 0.44 + qr + bodySize * 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${bodySize}" font-weight="700" fill="${NAVY}">${escapeXml(CTA_TEXT.action)}</text>
    <text x="${cx}" y="${h * 0.44 + qr + bodySize * 3.6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(bodySize * 1.1)}" font-weight="700" fill="${BLUE}">${link}</text>
    ${showName && partnerName ? `<text x="${cx}" y="${h * 0.95}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(bodySize * 0.85)}" fill="${MUTED}">Proposé par ${name}</text>` : ""}
  `);
}

function svgWrap(w: number, h: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

/** Découpe un texte en lignes centrées (approximation par nombre de caractères). */
function wrapText(
  text: string,
  cx: number,
  y: number,
  size: number,
  maxChars: number,
  color: string,
  font: string
): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  if (current) lines.push(current.trim());
  return lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${y + i * size * 1.35}" text-anchor="middle" font-family="${font}" font-size="${size}" fill="${color}">${escapeXml(line)}</text>`
    )
    .join("");
}

export function MarketingSupports({
  partnerName,
  shortLink,
  qrDataUrl,
}: {
  partnerName: string;
  shortLink: string;
  qrDataUrl: string;
}) {
  const [selected, setSelected] = React.useState<SupportId>("flyer");
  const [showName, setShowName] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const model = MODELS.find((m) => m.id === selected)!;
  const svg = React.useMemo(
    () => buildSvg(model, partnerName, showName, shortLink, qrDataUrl),
    [model, partnerName, showName, shortLink, qrDataUrl]
  );
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    triggerDownload(URL.createObjectURL(blob), `nireo-${model.id}-${slug(partnerName)}.svg`, true);
  };

  const downloadPng = async () => {
    setBusy(true);
    try {
      // Rastérisation haute résolution (×2) — fichier net pour l'impression.
      const scale = 2;
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Rendu impossible."));
        img.src = svgDataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = model.width * scale;
      canvas.height = model.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
      triggerDownload(url, `nireo-${model.id}-${slug(partnerName)}.png`, false);
      toast.success("Support PNG téléchargé.");
    } catch {
      toast.error("Téléchargement PNG impossible. Utilisez « Imprimer » puis « Enregistrer en PDF ».");
    } finally {
      setBusy(false);
    }
  };

  // PDF & impression : ouvre le support dans une fenêtre d'impression du
  // navigateur (« Imprimer » ou « Enregistrer en PDF »), sans dépendance.
  const print = () => {
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) {
      toast.error("Autorisez les pop-ups pour imprimer ou générer le PDF.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Support Nireo — ${escapeXml(model.name)}</title>
      <style>@page{margin:0} html,body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}
      img{max-width:100%;max-height:100vh}</style></head>
      <body><img src="${svgDataUrl}" onload="setTimeout(function(){window.focus();window.print();},250)" /></body></html>`);
    win.document.close();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Modèle</p>
          <div className="flex flex-col gap-1.5">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected === m.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="font-medium">{m.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{m.description}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showName}
            onChange={(e) => setShowName(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Afficher le nom du partenaire
        </label>

        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={print}>
            <Printer className="size-4" /> Imprimer / PDF
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPng} disabled={busy}>
            <Download className="size-4" /> {busy ? "Génération…" : "Télécharger PNG (HD)"}
          </Button>
          <Button size="sm" variant="outline" onClick={downloadSvg}>
            <Download className="size-4" /> Télécharger SVG
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pour un PDF : « Imprimer / PDF » puis, dans la fenêtre d’impression,
          choisissez « Enregistrer au format PDF ».
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Aperçu — {model.name}</p>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgDataUrl}
            alt={`Aperçu du support ${model.name}`}
            className="max-h-[70svh] w-auto max-w-full rounded-lg border border-border bg-white shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}

function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "partenaire"
  );
}

function triggerDownload(url: string, filename: string, revoke: boolean): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}
