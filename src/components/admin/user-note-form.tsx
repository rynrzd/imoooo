"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/types";

/** Ajout d'une note interne sur un compte (visible uniquement en admin). */
export function UserNoteForm({
  action,
}: {
  action: (note: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    const trimmed = note.trim();
    if (pending || !trimmed) return;
    startTransition(async () => {
      const result = await action(trimmed);
      if (result.ok) {
        toast.success("Note ajoutée.");
        setNote("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Note interne (jamais visible par le client)…"
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <Button variant="outline" size="sm" onClick={submit} disabled={pending || !note.trim()}>
        {pending ? "Ajout…" : "Ajouter la note"}
      </Button>
    </div>
  );
}
