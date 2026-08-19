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
import { EMAIL_VARIABLES, unknownVariables } from "@/lib/email/variables";
import type { EmailTemplate } from "@/lib/admin/emails";
import type { ActionResult } from "@/lib/admin/types";

/**
 * Création et modification d'un modèle d'e-mail.
 *
 * Le même dialogue sert aux deux : sans `template` il crée, avec `template`
 * il modifie. Un modèle n'est que du texte — il ne s'envoie pas d'ici, il
 * est proposé au moment de la rédaction.
 */

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 " +
  "focus-visible:ring-ring/50 dark:bg-input/30";

export function TemplateEditor({
  template,
  save,
  triggerLabel,
  triggerVariant = "outline",
}: {
  template?: EmailTemplate;
  save: (input: {
    id?: string;
    name: string;
    subject: string;
    body: string;
  }) => Promise<ActionResult>;
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(template?.name ?? "");
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [body, setBody] = React.useState(template?.body ?? "");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const unknown = unknownVariables(`${subject}\n${body}`);
  const ready = Boolean(name.trim() && subject.trim() && body.trim());

  const insertVariable = (token: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const run = () => {
    if (!ready || pending) return;
    startTransition(async () => {
      const result = await save({
        id: template?.id,
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      if (result.ok) {
        toast.success(result.message ?? "Modèle enregistré.");
        setOpen(false);
        if (!template) {
          setName("");
          setSubject("");
          setBody("");
        }
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
        // Réouvrir un modèle doit repartir de ce qui est enregistré, pas
        // d'une saisie abandonnée.
        if (!next && template) {
          setName(template.name);
          setSubject(template.subject);
          setBody(template.body);
        }
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
          <DialogDescription>
            Un modèle pré-remplit le sujet et le message au moment de la rédaction. Il ne
            déclenche aucun envoi par lui-même.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Nom du modèle</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Ex. Relance après inscription"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-subject">Sujet</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-body">Message</Label>
            <textarea
              id="template-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              maxLength={5000}
              className={TEXTAREA_CLASS}
              placeholder={"Bonjour {{prenom}},\n\n…"}
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={run} disabled={!ready || pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
