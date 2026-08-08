"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProEventAction } from "@/features/nireo-id/actions/professional";
import {
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
  EVENT_TYPE_LABELS,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  PRO_EVENT_TYPES,
  type EventType,
} from "@/features/nireo-id/constants";
import { formatFileSize } from "@/features/nireo-id/format";

const MAX_PHOTOS = 6;

/**
 * Enregistrement d'une intervention par un professionnel approuvé.
 * Le niveau « Validé par un professionnel » est posé par le serveur, après
 * vérification du statut du compte ET de l'autorisation sur cet objet.
 */
export function InterventionForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [type, setType] = React.useState<EventType>("reparation");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = React.useState("");
  const [diagnostic, setDiagnostic] = React.useState("");
  const [parts, setParts] = React.useState("");
  const [partsOrigin, setPartsOrigin] = React.useState("");
  const [warranty, setWarranty] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [ownerComment, setOwnerComment] = React.useState("");
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [report, setReport] = React.useState<File | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addPhoto = (file: File | null) => {
    if (!file) return;
    if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
      toast.error("Format d'image non pris en charge (JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(`Photo trop volumineuse : ${formatFileSize(MAX_PHOTO_BYTES)} maximum.`);
      return;
    }
    setPhotos((current) => (current.length >= MAX_PHOTOS ? current : [...current, file]));
  };

  const pickReport = (file: File | null) => {
    if (!file) return;
    if (!(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(file.type)) {
      toast.error("Format non pris en charge (PDF, JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`Fichier trop volumineux : ${formatFileSize(MAX_DOCUMENT_BYTES)} maximum.`);
      return;
    }
    setReport(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("type", type);
    form.set("effective_date", date);
    form.set("title", title);
    form.set("diagnostic", diagnostic);
    form.set("parts", parts);
    form.set("parts_origin", partsOrigin);
    form.set("warranty_months", warranty);
    form.set("cost_euros", cost);
    form.set("owner_comment", ownerComment);
    for (const photo of photos) form.append("photos", photo);
    if (report) form.set("report", report);

    const result = await addProEventAction(form);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Intervention enregistrée dans le passeport.");
    setTitle("");
    setDiagnostic("");
    setParts("");
    setPartsOrigin("");
    setWarranty("");
    setCost("");
    setOwnerComment("");
    setPhotos([]);
    setReport(null);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="nid-panel space-y-4 rounded-2xl p-5 sm:p-6" noValidate>
      <h2 className="text-sm font-semibold text-foreground">Enregistrer une intervention</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pro-type">Type d’intervention</Label>
          <select
            id="pro-type"
            value={type}
            onChange={(event) => setType(event.target.value as EventType)}
            className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PRO_EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {EVENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pro-date">Date</Label>
          <Input
            id="pro-date"
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pro-title">Intitulé</Label>
        <Input
          id="pro-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex. Remplacement écran + nappe tactile"
          maxLength={140}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pro-diagnostic">Diagnostic</Label>
        <textarea
          id="pro-diagnostic"
          value={diagnostic}
          onChange={(event) => setDiagnostic(event.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pro-parts">Pièces remplacées</Label>
          <Input
            id="pro-parts"
            value={parts}
            onChange={(event) => setParts(event.target.value)}
            maxLength={300}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pro-origin">Origine des pièces</Label>
          <Input
            id="pro-origin"
            value={partsOrigin}
            onChange={(event) => setPartsOrigin(event.target.value)}
            placeholder="Origine constructeur, compatible…"
            maxLength={160}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pro-warranty">Garantie d’intervention (mois)</Label>
          <Input
            id="pro-warranty"
            type="number"
            min={0}
            max={120}
            value={warranty}
            onChange={(event) => setWarranty(event.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pro-cost">Montant facturé (€)</Label>
          <Input
            id="pro-cost"
            type="number"
            min={0}
            step="0.01"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pro-comment">Commentaire visible par le propriétaire</Label>
        <textarea
          id="pro-comment"
          value={ownerComment}
          onChange={(event) => setOwnerComment(event.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pro-report">Facture ou compte rendu</Label>
        {report ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-3 py-2.5">
            <span className="min-w-0 truncate text-sm text-foreground">{report.name}</span>
            <Button variant="ghost" size="sm" type="button" onClick={() => setReport(null)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <input
            id="pro-report"
            type="file"
            accept={ALLOWED_DOCUMENT_MIME.join(",")}
            onChange={(event) => pickReport(event.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-border bg-transparent px-3 py-3 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Ce document suivra l’appareil lors d’un futur transfert.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">
          Photos avant / après ({photos.length}/{MAX_PHOTOS})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <span
              key={`${photo.name}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground"
            >
              <span className="max-w-[10rem] truncate">{photo.name}</span>
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                aria-label={`Retirer ${photo.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        {photos.length < MAX_PHOTOS ? (
          <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50">
            <ImagePlus className="size-4" aria-hidden />
            Ajouter une photo
            <input
              type="file"
              accept={ALLOWED_IMAGE_MIME.join(",")}
              className="sr-only"
              onChange={(event) => {
                addPhoto(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        En enregistrant cette intervention, vous certifiez l’avoir réellement
        effectuée. Elle portera votre identité professionnelle et le niveau
        « Validé par un professionnel ». Une erreur se corrige par une
        révocation motivée.
      </p>

      <Button type="submit" data-touch disabled={pending || title.trim().length < 2}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Enregistrement…
          </>
        ) : (
          <>
            <BadgeCheck className="size-4" data-icon="inline-start" />
            Enregistrer l’intervention
          </>
        )}
      </Button>
    </form>
  );
}
