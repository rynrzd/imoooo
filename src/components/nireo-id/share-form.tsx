"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createShareAction } from "@/features/nireo-id/actions/owner";
import {
  DOCUMENT_KIND_LABELS,
  SHARE_DURATIONS,
  SHARE_SECTIONS,
  SHARE_SECTION_LABELS,
  type ShareSection,
} from "@/features/nireo-id/constants";
import { formatFileSize } from "@/features/nireo-id/format";
import type { DocumentRow } from "@/features/nireo-id/types";
import { ShareResultCard } from "./access-manager";

/**
 * Création d'un dossier partagé : durée, sections, documents précis,
 * téléchargement, quatre derniers caractères du numéro de série.
 * Rien n'est partagé par défaut au-delà des caractéristiques.
 */
export function ShareForm({
  assetId,
  documents,
  hasSerial,
}: {
  assetId: string;
  documents: DocumentRow[];
  hasSerial: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = React.useState("");
  const [duration, setDuration] = React.useState<number>(168);
  const [sections, setSections] = React.useState<ShareSection[]>([
    "caracteristiques",
    "historique",
  ]);
  const [documentIds, setDocumentIds] = React.useState<string[]>([]);
  const [allowDownload, setAllowDownload] = React.useState(false);
  const [showSerial, setShowSerial] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<{ url: string; expires_at: string } | null>(null);

  const toggleSection = (section: ShareSection) =>
    setSections((current) =>
      current.includes(section)
        ? current.filter((value) => value !== section)
        : [...current, section]
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);

    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("label", label);
    form.set("duration_hours", String(duration));
    for (const section of sections) form.append("sections", section);
    if (sections.includes("documents")) {
      for (const documentId of documentIds) form.append("document_ids", documentId);
    }
    form.set("allow_download", allowDownload ? "true" : "false");
    form.set("show_serial_last4", showSerial ? "true" : "false");

    const result = await createShareAction(form);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCreated(result.data);
    toast.success("Lien de partage créé.");
    router.refresh();
  };

  if (created) {
    return (
      <div className="space-y-4">
        <ShareResultCard url={created.url} expiresAt={created.expires_at} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCreated(null)}>
            Créer un autre lien
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push(`/id/app/objets/${assetId}?onglet=acces`)}
          >
            Voir les accès du téléphone
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="nid-panel space-y-5 rounded-lg p-5 sm:p-6">
      <div className="space-y-1.5">
        <Label htmlFor="share-label">Nom du lien (facultatif)</Label>
        <Input
          id="share-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Ex. Acheteur Leboncoin"
          maxLength={80}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Durée de validité</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SHARE_DURATIONS.map((option) => (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                duration === option.value
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="duration"
                value={option.value}
                checked={duration === option.value}
                onChange={() => setDuration(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Sections partagées</legend>
        <div className="mt-2 space-y-2">
          {SHARE_SECTIONS.map((section) => (
            <label
              key={section}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={sections.includes(section)}
                onChange={() => toggleSection(section)}
                className="size-4 rounded border-input"
              />
              <span className="text-foreground">{SHARE_SECTION_LABELS[section]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {sections.includes("documents") ? (
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            Documents à inclure
          </legend>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aucun document dans ce dossier.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {documents.map((document) => (
                <label
                  key={document.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={documentIds.includes(document.id)}
                    onChange={() =>
                      setDocumentIds((current) =>
                        current.includes(document.id)
                          ? current.filter((value) => value !== document.id)
                          : [...current, document.id]
                      )
                    }
                    className="size-4 rounded border-input"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">
                      {document.original_name || DOCUMENT_KIND_LABELS[document.kind]}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {DOCUMENT_KIND_LABELS[document.kind]} ·{" "}
                      {formatFileSize(document.size_bytes)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(event) => setAllowDownload(event.target.checked)}
              className="size-4 rounded border-input"
            />
            <span className="text-foreground">Autoriser l’ouverture des documents</span>
          </label>
        </fieldset>
      ) : null}

      {hasSerial ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={showSerial}
            onChange={(event) => setShowSerial(event.target.checked)}
            className="size-4 rounded border-input"
          />
          <span className="text-foreground">
            Afficher les 4 derniers caractères du numéro de série
          </span>
        </label>
      ) : null}

      <p className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Le lien est non devinable, expire automatiquement et peut être révoqué
        à tout moment. L’IMEI et le numéro de série complets ne sont jamais
        partagés.
      </p>

      <Button type="submit" data-touch disabled={pending || sections.length === 0}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Création…
          </>
        ) : (
          <>
            <Share2 className="size-4" data-icon="inline-start" />
            Créer le lien de partage
          </>
        )}
      </Button>
    </form>
  );
}
