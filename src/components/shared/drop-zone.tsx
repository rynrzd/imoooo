"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  /** Appelé pour chaque fichier choisi (clic ou glisser-déposer). */
  onFile: (file: File) => void;
  /** Types acceptés par l'input fichier (ex. "image/*"). */
  accept?: string;
  /** Autorise la sélection de plusieurs fichiers à la fois. */
  multiple?: boolean;
  label: string;
  hint?: string;
  className?: string;
}

/** Zone de dépôt de fichier : clic ou glisser-déposer, avec retour visuel. */
export function DropZone({
  onFile,
  accept,
  multiple = false,
  label,
  hint,
  className,
}: DropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const emit = (files: FileList | null) => {
    if (!files) return;
    const list = multiple ? Array.from(files) : Array.from(files).slice(0, 1);
    for (const file of list) onFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    emit(event.dataTransfer.files);
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        dragging
          ? "border-foreground/40 bg-muted"
          : "border-border bg-card/50 hover:border-foreground/25 hover:bg-muted/50",
        className
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-xs">
        <UploadCloud className="size-4" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
