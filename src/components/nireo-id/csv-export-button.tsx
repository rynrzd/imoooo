"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/download";

/**
 * Export CSV réel, construit à partir des données déjà affichées.
 * Aucune donnée supplémentaire n'est demandée au serveur, et les
 * identifiants complets ne sont jamais inclus.
 */
export function CsvExportButton({
  filename,
  header,
  rows,
  label = "Exporter en CSV",
}: {
  filename: string;
  header: string[];
  rows: (string | number | null)[][];
  label?: string;
}) {
  const download = () => {
    const escape = (value: string | number | null) => {
      const text = value === null ? "" : String(value);
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const content = [header.join(";"), ...rows.map((row) => row.map(escape).join(";"))].join("\n");
    downloadFile(filename, `﻿${content}`, "text/csv;charset=utf-8");
  };

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download className="size-3.5" data-icon="inline-start" />
      {label}
    </Button>
  );
}
