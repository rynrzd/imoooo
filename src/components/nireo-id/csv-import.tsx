"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CSV_TEMPLATE_HEADER } from "@/features/nireo-id/constants";
import { importCsvAction, previewCsvAction } from "@/features/nireo-id/actions/fleet";
import type { CsvImportResult, CsvPreview } from "@/features/nireo-id/server/fleet";
import { downloadFile } from "@/lib/download";

/**
 * Import CSV d'un parc.
 *
 * Rien n'est écrit avant l'aperçu : les lignes invalides et les doublons
 * sont affichés, un rapport d'erreurs est téléchargeable, et l'import ne
 * s'exécute qu'après confirmation explicite.
 */
export function CsvImport({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<CsvPreview | null>(null);
  const [result, setResult] = React.useState<CsvImportResult | null>(null);
  const [pending, setPending] = React.useState(false);

  const analyse = async () => {
    if (!file || pending) return;
    setPending(true);
    setResult(null);
    const form = new FormData();
    form.set("workspace_id", workspaceId);
    form.set("fichier", file);
    const response = await previewCsvAction(form);
    setPending(false);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setPreview(response.data);
  };

  const confirm = async () => {
    if (!file || pending) return;
    setPending(true);
    const form = new FormData();
    form.set("workspace_id", workspaceId);
    form.set("fichier", file);
    form.set("confirm", "true");
    const response = await importCsvAction(form);
    setPending(false);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setResult(response.data);
    setPreview(null);
    toast.success(`${response.data.created} téléphone(s) ajouté(s).`);
    router.refresh();
  };

  const downloadTemplate = () => {
    downloadFile(
      "modele-import-nireo-id.csv",
      `﻿${CSV_TEMPLATE_HEADER}\nApple;iPhone 15;128 Go;Noir;;;PARC-001;2025-03-14;;neuf;2027-03-14;;\n`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadErrors = () => {
    const rows = preview
      ? preview.rows
          .filter((row) => row.error || row.duplicate)
          .map((row) => `${row.line};${row.error ?? "Doublon"}`)
      : result
        ? result.errors.map((error) => `${error.line};${error.message}`)
        : [];
    downloadFile(
      "rapport-erreurs-import.csv",
      `﻿ligne;probleme\n${rows.join("\n")}\n`,
      "text/csv;charset=utf-8"
    );
  };

  return (
    <div className="space-y-5">
      <div className="nid-panel rounded-2xl p-5">
        <Label htmlFor="csv-file">Fichier CSV</Label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setResult(null);
          }}
          className="mt-1.5 block w-full text-sm text-foreground"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Colonnes attendues : {CSV_TEMPLATE_HEADER.replaceAll(";", ", ")}. Séparateur « ; » ou
          « , ». 2 Mo maximum.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={analyse} disabled={!file || pending} data-touch>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Analyse…
              </>
            ) : (
              "Prévisualiser"
            )}
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            Télécharger le modèle
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="nid-panel rounded-2xl p-5">
          <h2 className="font-medium text-foreground">Aperçu de l’import</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.valid} ligne{preview.valid > 1 ? "s" : ""} valide
            {preview.valid > 1 ? "s" : ""} · {preview.invalid} invalide
            {preview.invalid > 1 ? "s" : ""} · {preview.duplicates} doublon
            {preview.duplicates > 1 ? "s" : ""}
          </p>

          <div className="nid-scroll-x mt-3">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Ligne</th>
                  <th className="py-2 pr-3 font-medium">Téléphone</th>
                  <th className="py-2 pr-3 font-medium">Détenteur</th>
                  <th className="py-2 font-medium">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.line} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground tabular-nums">{row.line}</td>
                    <td className="py-2 pr-3 text-foreground">
                      {row.value ? `${row.value.marque} ${row.value.modele}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.value?.detenteur_nom || row.value?.detenteur_email || "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {row.error ? (
                        <span className="text-[var(--nid-danger)]">{row.error}</span>
                      ) : row.duplicate ? (
                        <span className="text-[var(--nid-warning)]">
                          Doublon : déjà enregistré
                        </span>
                      ) : (
                        <span className="text-[var(--nid-success)]">Sera importé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={confirm} disabled={pending || preview.valid === 0} data-touch>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Import…
                </>
              ) : (
                `Importer ${preview.valid} téléphone(s)`
              )}
            </Button>
            {preview.invalid + preview.duplicates > 0 ? (
              <Button variant="outline" onClick={downloadErrors}>
                Télécharger le rapport d’erreurs
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="nid-panel rounded-2xl p-5">
          <h2 className="font-medium text-foreground">Import terminé</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.created} téléphone{result.created > 1 ? "s" : ""} ajouté
            {result.created > 1 ? "s" : ""} · {result.skipped} ligne
            {result.skipped > 1 ? "s" : ""} ignorée{result.skipped > 1 ? "s" : ""}
          </p>
          {result.errors.length > 0 ? (
            <>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {result.errors.slice(0, 20).map((error) => (
                  <li key={`${error.line}-${error.message}`}>
                    Ligne {error.line} : {error.message}
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  Télécharger le rapport d’erreurs
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
