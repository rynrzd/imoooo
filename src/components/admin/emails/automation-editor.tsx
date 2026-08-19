"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EMAIL_VARIABLES, unknownVariables } from "@/lib/email/variables";
import type { ActionResult } from "@/lib/admin/types";

/**
 * Édition d'une automatisation : son texte et son activation, rien d'autre.
 *
 * Le déclencheur est affiché en clair mais n'est PAS modifiable — il vit
 * dans le code, à l'endroit où l'événement est certain. Le bouton du
 * courriel non plus : c'est une destination interne, pas du contenu.
 */

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 " +
  "focus-visible:ring-ring/50 dark:bg-input/30";

export function AutomationEditor({
  kind,
  name,
  trigger,
  enabled,
  subject,
  body,
  ctaLabel,
  save,
  sendTest,
}: {
  kind: string;
  name: string;
  trigger: string;
  enabled: boolean;
  subject: string;
  body: string;
  ctaLabel: string | null;
  save: (input: {
    kind: string;
    enabled: boolean;
    subject: string;
    body: string;
  }) => Promise<ActionResult>;
  sendTest: (kind: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [testing, startTest] = React.useTransition();

  const [on, setOn] = React.useState(enabled);
  const [draftSubject, setDraftSubject] = React.useState(subject);
  const [draftBody, setDraftBody] = React.useState(body);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const unknown = unknownVariables(`${draftSubject}\n${draftBody}`);
  const dirty = on !== enabled || draftSubject !== subject || draftBody !== body;
  const ready = Boolean(draftSubject.trim() && draftBody.trim());

  const insertVariable = (token: string) => {
    const el = bodyRef.current;
    if (!el) {
      setDraftBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? draftBody.length;
    const end = el.selectionEnd ?? draftBody.length;
    setDraftBody(draftBody.slice(0, start) + token + draftBody.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const run = () => {
    if (!ready || pending) return;
    startTransition(async () => {
      const result = await save({
        kind,
        enabled: on,
        subject: draftSubject.trim(),
        body: draftBody.trim(),
      });
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const test = () => {
    if (testing) return;
    startTest(async () => {
      const result = await sendTest(kind);
      if (result.ok) {
        toast.success(result.message ?? "Test envoyé.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Une saisie abandonnée ne doit pas rester à l'écran la fois suivante.
        if (!next) {
          setOn(enabled);
          setDraftSubject(subject);
          setDraftBody(body);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Ouvrir</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{trigger}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <div>
              <Label htmlFor={`automation-${kind}-enabled`}>Automatisation active</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Désactivée, aucune ligne n’est écrite et aucun e-mail ne part.
              </p>
            </div>
            <Switch id={`automation-${kind}-enabled`} checked={on} onCheckedChange={setOn} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`automation-${kind}-subject`}>Sujet</Label>
            <Input
              id={`automation-${kind}-subject`}
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              maxLength={150}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`automation-${kind}-body`}>Message</Label>
            <textarea
              id={`automation-${kind}-body`}
              ref={bodyRef}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={9}
              maxLength={5000}
              className={TEXTAREA_CLASS}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insérer :</span>
              {EMAIL_VARIABLES.map((variable) => (
                <Button
                  key={variable.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 font-mono text-xs"
                  onClick={() => insertVariable(variable.token)}
                >
                  {variable.token}
                </Button>
              ))}
            </div>
            {unknown.length > 0 ? (
              <p className="text-xs text-destructive">
                Variable{unknown.length > 1 ? "s" : ""} inconnue
                {unknown.length > 1 ? "s" : ""} : {unknown.map((u) => `{{${u}}}`).join(", ")}.
              </p>
            ) : null}
          </div>

          {ctaLabel ? (
            <p className="text-xs text-muted-foreground">
              L’e-mail se termine par un bouton «&nbsp;{ctaLabel}&nbsp;». Il est défini par
              le code : c’est une destination dans l’application, pas du contenu.
            </p>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {/* Le test envoie le texte ENREGISTRÉ : proposer de tester une
              saisie non sauvegardée ferait recevoir autre chose que ce qui
              est affiché. */}
          <Button variant="ghost" onClick={test} disabled={testing || dirty}>
            {testing
              ? "Envoi du test…"
              : dirty
                ? "Enregistrez pour tester"
                : "M’envoyer un test"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button onClick={run} disabled={!ready || !dirty || pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
