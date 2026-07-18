"use client";

import * as React from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropZone } from "@/components/shared/drop-zone";
import { downloadFile } from "@/lib/download";
import { useAppStore } from "@/lib/store";
import type { PropertyType } from "@/lib/types";

const HEADER =
  "nom;adresse;code_postal;ville;type;surface;pieces;prix_achat;date_achat;loyer;charges";
const EXAMPLE_ROW = "T2 Part-Dieu;12 avenue Félix Faure;69003;Lyon;T2;42;2;189000;2022-05-12;780;60";

const VALID_TYPES: PropertyType[] = ["Studio", "T1", "T2", "T3", "T4", "T5", "Maison"];

interface ParsedRow {
  line: number;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  type: PropertyType;
  surface: number;
  rooms: number;
  purchasePrice: number;
  purchaseDate: string;
  rent: number;
  charges: number;
}

/** Analyse le CSV (séparateur ;) et sépare lignes valides / ignorées. */
function parseCsv(text: string): { rows: ParsedRow[]; skipped: number[] } {
  const rows: ParsedRow[] = [];
  const skipped: number[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    // L'en-tête éventuel est ignoré.
    if (index === 0 && line.toLowerCase().startsWith("nom;")) return;

    const parts = line.split(";").map((p) => p.trim());
    const [
      name,
      address,
      postalCode,
      city,
      type,
      surface,
      rooms,
      purchasePrice,
      purchaseDate,
      rent,
      charges,
    ] = parts;

    const numeric = {
      surface: Number(surface),
      rooms: Number(rooms),
      purchasePrice: Number(purchasePrice),
      rent: Number(rent),
      charges: Number(charges ?? "0"),
    };

    const valid =
      parts.length >= 10 &&
      name?.length >= 2 &&
      address?.length >= 4 &&
      /^\d{5}$/.test(postalCode ?? "") &&
      city?.length >= 2 &&
      VALID_TYPES.includes(type as PropertyType) &&
      numeric.surface > 0 &&
      Number.isInteger(numeric.rooms) &&
      numeric.rooms >= 1 &&
      numeric.purchasePrice > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate ?? "") &&
      numeric.rent > 0 &&
      numeric.charges >= 0;

    if (!valid) {
      skipped.push(index + 1);
      return;
    }
    rows.push({
      line: index + 1,
      name,
      address,
      postalCode,
      city,
      type: type as PropertyType,
      purchaseDate,
      ...numeric,
    });
  });

  return { rows, skipped };
}

/** Import de logements depuis un fichier CSV (modèle téléchargeable). */
export function ImportPropertiesDialog() {
  const { addProperty } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [parsed, setParsed] = React.useState<{
    rows: ParsedRow[];
    skipped: number[];
    fileName: string;
  } | null>(null);
  const [importing, setImporting] = React.useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parseCsv(text);
    setParsed({ ...result, fileName: file.name });
    if (result.rows.length === 0) {
      toast.error("Aucune ligne valide dans ce fichier. Vérifiez le modèle.");
    }
  };

  const runImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImporting(true);
    try {
      for (const row of parsed.rows) {
        await addProperty({
          name: row.name,
          address: row.address,
          postalCode: row.postalCode,
          city: row.city,
          type: row.type,
          surface: row.surface,
          rooms: row.rooms,
          purchasePrice: row.purchasePrice,
          purchaseDate: row.purchaseDate,
          rent: row.rent,
          charges: row.charges,
          status: "vacant",
          photo: "",
        });
      }
      toast.success(
        `${parsed.rows.length} logement${parsed.rows.length > 1 ? "s" : ""} importé${parsed.rows.length > 1 ? "s" : ""}${parsed.skipped.length > 0 ? ` · ${parsed.skipped.length} ligne${parsed.skipped.length > 1 ? "s" : ""} ignorée${parsed.skipped.length > 1 ? "s" : ""}` : ""}.`
      );
      setParsed(null);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setParsed(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <FileUp data-icon="inline-start" />
        Importer
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer des logements</DialogTitle>
          <DialogDescription>
            Fichier CSV, séparateur « ; » — une ligne par logement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadFile(
                "immopilot-modele-logements.csv",
                `${HEADER}\n${EXAMPLE_ROW}\n`,
                "text/csv;charset=utf-8"
              )
            }
          >
            <Download data-icon="inline-start" />
            Télécharger le modèle CSV
          </Button>

          <DropZone
            label="Glissez-déposez votre fichier CSV"
            hint="ou cliquez pour le choisir"
            accept=".csv,text/csv"
            onFile={(file) => void handleFile(file)}
          />

          {parsed ? (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{parsed.fileName}</p>
              <p className="text-muted-foreground">
                {parsed.rows.length} logement{parsed.rows.length > 1 ? "s" : ""} prêt
                {parsed.rows.length > 1 ? "s" : ""} à importer
                {parsed.skipped.length > 0
                  ? ` · lignes ignorées : ${parsed.skipped.join(", ")}`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!parsed || parsed.rows.length === 0 || importing}
            onClick={() => void runImport()}
          >
            <Upload data-icon="inline-start" />
            {importing ? "Import…" : "Importer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
