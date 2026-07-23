"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/admin/types";

export interface TicketData {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  admin_status: string;
  priority: string;
  internal_note: string;
  replied_at: string | null;
  created_at: string;
}

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 " +
  "focus-visible:ring-ring/50 dark:bg-input/30";

/** Traitement d'un ticket : statut, priorité, note interne, réponse e-mail. */
export function TicketDialog({
  ticket,
  emailEnabled,
  onStatus,
  onPriority,
  onNote,
  onReply,
}: {
  ticket: TicketData;
  emailEnabled: boolean;
  onStatus: (status: string) => Promise<ActionResult>;
  onPriority: (priority: string) => Promise<ActionResult>;
  onNote: (note: string) => Promise<ActionResult>;
  onReply: (message: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState(ticket.admin_status);
  const [priority, setPriority] = React.useState(ticket.priority);
  const [note, setNote] = React.useState(ticket.internal_note);
  const [reply, setReply] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    if (pending) return;
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs" />}>Traiter</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
          <DialogDescription>
            {ticket.name} · {ticket.email}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {ticket.message}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`status-${ticket.id}`}>Statut</Label>
              <div className="flex gap-2">
                <select
                  id={`status-${ticket.id}`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="ouvert">Ouvert</option>
                  <option value="en_cours">En cours</option>
                  <option value="resolu">Résolu</option>
                  <option value="ferme">Fermé</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || status === ticket.admin_status}
                  onClick={() => run(() => onStatus(status))}
                >
                  OK
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`priority-${ticket.id}`}>Priorité</Label>
              <div className="flex gap-2">
                <select
                  id={`priority-${ticket.id}`}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="basse">Basse</option>
                  <option value="normale">Normale</option>
                  <option value="haute">Haute</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || priority === ticket.priority}
                  onClick={() => run(() => onPriority(priority))}
                >
                  OK
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`note-${ticket.id}`}>Note interne</Label>
            <textarea
              id={`note-${ticket.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className={TEXTAREA_CLASS}
              placeholder="Jamais visible par le client…"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending || note === ticket.internal_note}
              onClick={() => run(() => onNote(note))}
            >
              Enregistrer la note
            </Button>
          </div>

          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <Label htmlFor={`reply-${ticket.id}`}>
              Répondre par e-mail
              {ticket.replied_at ? " (déjà répondu)" : ""}
            </Label>
            <textarea
              id={`reply-${ticket.id}`}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              maxLength={5000}
              className={TEXTAREA_CLASS}
              placeholder={
                emailEnabled
                  ? `Réponse envoyée à ${ticket.email}…`
                  : "Fournisseur d'e-mail non configuré : envoi indisponible."
              }
              disabled={!emailEnabled}
            />
            <Button
              size="sm"
              disabled={pending || !emailEnabled || !reply.trim()}
              onClick={() =>
                run(async () => {
                  const result = await onReply(reply.trim());
                  if (result.ok) setReply("");
                  return result;
                })
              }
            >
              {pending ? "Envoi…" : "Envoyer la réponse"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
