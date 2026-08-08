"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addEventAction } from "@/features/nireo-id/actions/owner";
import {
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
  EVENT_TYPE_LABELS,
  MAX_CONDITION_PHOTOS,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  OWNER_EVENT_TYPES,
  type EventType,
} from "@/features/nireo-id/constants";
import { formatFileSize } from "@/features/nireo-id/format";

/**
 * Déclaration d'un événement par le propriétaire.
 * L'événement porte toujours le niveau « Déclaré par le propriétaire » ;
 * joindre un document le fait passer à « Document fourni ».
 */
export function EventForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [type, setType] = React.useState<EventType>("reparation");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [parts, setParts] = React.useState("");
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [document, setDocument] = React.useState<File | null>(null);
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
    setPhotos((current) =>
      current.length >= MAX_CONDITION_PHOTOS ? current : [...current, file]
    );
  };

  const pickDocument = (file: File | null) => {
    if (!file) return;
    if (!(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(file.type)) {
      toast.error("Format non pris en charge (PDF, JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`Fichier trop volumineux : ${formatFileSize(MAX_DOCUMENT_BYTES)} maximum.`);
      return;
    }
    setDocument(file);
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
    form.set("description", description);
    form.set("cost_euros", cost);
    form.set("parts", parts);
    for (const photo of photos) form.append("photos", photo);
    if (document) form.set("document", document);

    const result = await addEventAction(form);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Événement ajouté à l'historique.");
    router.push(`/id/app/objets/${assetId}?onglet=historique`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="nid-panel space-y-4 rounded-2xl p-5 sm:p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-type">Type d’événement</Label>
          <select
            id="event-type"
            value={type}
            onChange={(event) => setType(event.target.value as EventType)}
            className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {OWNER_EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {EVENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-date">Date</Label>
          <Input
            id="event-date"
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-title">Titre</Label>
        <Input
          id="event-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex. Remplacement de la batterie"
          maxLength={140}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-description">Description (facultatif)</Label>
        <textarea
          id="event-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-parts">Pièces remplacées (facultatif)</Label>
          <Input
            id="event-parts"
            value={parts}
            onChange={(event) => setParts(event.target.value)}
            placeholder="Batterie, écran…"
            maxLength={300}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-cost">Coût en euros (facultatif)</Label>
          <Input
            id="event-cost"
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
        <Label htmlFor="event-document">Document justificatif (facultatif)</Label>
        {document ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-3 py-2.5">
            <span className="min-w-0 truncate text-sm text-foreground">{document.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setDocument(null)} type="button">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <input
            id="event-document"
            type="file"
            accept={ALLOWED_DOCUMENT_MIME.join(",")}
            onChange={(event) => pickDocument(event.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-border bg-transparent px-3 py-3 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Joindre un document fait passer l’événement au niveau « Document
          fourni ». Nireo ne certifie pas son authenticité.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">
          Photos ({photos.length}/{MAX_CONDITION_PHOTOS})
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
        {photos.length < MAX_CONDITION_PHOTOS ? (
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

      <Button type="submit" data-touch disabled={pending || title.trim().length < 2}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Enregistrement…
          </>
        ) : (
          "Ajouter à l’historique"
        )}
      </Button>
    </form>
  );
}
