"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  EMAIL_VARIABLES,
  fillVariables,
  unknownVariables,
  variableValues,
} from "@/lib/email/variables";
import type { EmailRecipient, EmailTemplate } from "@/lib/admin/emails";
import type { ActionResult } from "@/lib/admin/types";

/**
 * Rédaction d'un e-mail depuis l'administration.
 *
 * L'aperçu utilise la MÊME fonction de remplacement que l'envoi
 * (`fillVariables`) : ce qui est affiché est ce qui partira, à la mise en
 * page HTML près. Aucun bouton n'annonce un succès avant la réponse du
 * serveur — tant que l'action n'a pas confirmé, l'écran dit « Envoi… ».
 */

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 " +
  "focus-visible:ring-ring/50 dark:bg-input/30";

const BODY_MAX = 5000;

export interface EmailComposerProps {
  templates: EmailTemplate[];
  /** Destinataire pré-sélectionné (bouton « Envoyer un e-mail » d'une fiche). */
  initialRecipient?: EmailRecipient | null;
  /** false = aucun fournisseur configuré : l'envoi est impossible, on le dit. */
  canSend: boolean;
  search: (q: string) => Promise<EmailRecipient[]>;
  send: (input: {
    userId: string;
    subject: string;
    body: string;
    token: string;
  }) => Promise<ActionResult>;
  /** Élément déclencheur ; par défaut un bouton compact. */
  triggerRender?: React.ReactElement;
  triggerLabel?: string;
  /**
   * Ouvre l'éditeur d'emblée — utilisé quand on arrive depuis la fiche d'un
   * client : demander un clic de plus pour un message déjà commencé n'a pas
   * de sens.
   */
  defaultOpen?: boolean;
}

export function EmailComposer({
  templates,
  initialRecipient = null,
  canSend,
  search,
  send,
  triggerRender,
  triggerLabel = "Nouveau message",
  defaultOpen = false,
}: EmailComposerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen);
  const [pending, startTransition] = React.useTransition();

  const [recipient, setRecipient] = React.useState<EmailRecipient | null>(initialRecipient);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<EmailRecipient[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [showPreview, setShowPreview] = React.useState(false);

  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  /**
   * Jeton d'idempotence. Créé au premier envoi et conservé tant que le
   * message n'est pas parti : deux clics = un seul e-mail. Remis à zéro
   * après un succès, pour que le message suivant soit bien un nouvel envoi.
   */
  const tokenRef = React.useRef("");

  const term = query.trim();
  const searchable = term.length >= 2;

  /**
   * Recherche différée : on n'interroge pas le serveur à chaque frappe.
   *
   * Aucun `setState` n'est appelé dans le CORPS de l'effet — la règle
   * `set-state-in-effect` l'interdit, et elle a raison : ce serait un rendu
   * en cascade. Une saisie trop courte n'efface donc pas les résultats, elle
   * les rend simplement invisibles (voir `visibleResults` plus bas), ce qui
   * revient au même à l'écran sans repasser par React.
   */
  React.useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setSearching(true);
      try {
        const found = await search(term);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, searchable, search]);

  // Ce que l'écran montre réellement — dérivé, jamais stocké.
  const visibleResults = searchable ? results : [];
  const isSearching = searchable && searching;

  const reset = () => {
    setRecipient(initialRecipient);
    setQuery("");
    setResults([]);
    setSubject("");
    setBody("");
    setShowPreview(false);
    tokenRef.current = "";
  };

  /** Insère un jeton à la position du curseur, pas à la fin du texte. */
  const insertVariable = (token: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const applyTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
    // Le message change : le prochain envoi est un nouvel envoi.
    tokenRef.current = "";
  };

  const values = variableValues(recipient ?? {});
  const previewSubject = fillVariables(subject, values);
  const previewBody = fillVariables(body, values);
  const unknown = unknownVariables(`${subject}\n${body}`);

  const ready = Boolean(recipient && subject.trim() && body.trim()) && canSend;

  const onSend = () => {
    if (!recipient || pending || !ready) return;
    if (!tokenRef.current) {
      tokenRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    startTransition(async () => {
      const result = await send({
        userId: recipient.id,
        subject: subject.trim(),
        body: body.trim(),
        token: tokenRef.current,
      });
      if (result.ok) {
        toast.success(result.message ?? "Message envoyé.");
        reset();
        setOpen(false);
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
        if (!next) reset();
      }}
    >
      <DialogTrigger render={triggerRender ?? <Button size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Écrire à un client</DialogTitle>
          <DialogDescription>
            Le message part avec l’en-tête et le pied de page Nireo, comme les e-mails
            automatiques.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ---------------- Destinataire ---------------- */}
          <div className="space-y-1.5">
            <Label htmlFor="composer-recipient">Destinataire</Label>
            {recipient ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {recipient.full_name || "Sans nom"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
                </div>
                <Badge variant="outline">{recipient.plan_label}</Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Changer de destinataire"
                  onClick={() => {
                    setRecipient(null);
                    setQuery("");
                  }}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="composer-recipient"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un compte (nom ou e-mail)…"
                    className="pl-8"
                    autoComplete="off"
                  />
                  {isSearching ? (
                    <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                {searchable && !isSearching && visibleResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun compte trouvé.</p>
                ) : null}
                {visibleResults.length > 0 ? (
                  <ul className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
                    {visibleResults.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipient(item);
                            setResults([]);
                            setQuery("");
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {item.full_name || "Sans nom"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.email}
                            </span>
                          </span>
                          <Badge variant="outline">{item.plan_label}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Seuls les comptes Nireo peuvent être destinataires : chaque envoi reste
                  rattaché à une fiche client.
                </p>
              </>
            )}
          </div>

          {/* ---------------- Modèle ---------------- */}
          {templates.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="composer-template">Partir d’un modèle</Label>
              <select
                id="composer-template"
                defaultValue=""
                onChange={(e) => {
                  applyTemplate(e.target.value);
                  e.target.value = "";
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">Choisir un modèle…</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* ---------------- Sujet ---------------- */}
          <div className="space-y-1.5">
            <Label htmlFor="composer-subject">Sujet</Label>
            <Input
              id="composer-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                tokenRef.current = "";
              }}
              maxLength={150}
              placeholder="Ex. Une question sur votre espace Nireo"
            />
          </div>

          {/* ---------------- Message ---------------- */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="composer-body">Message</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {body.length} / {BODY_MAX}
              </span>
            </div>
            <textarea
              id="composer-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                tokenRef.current = "";
              }}
              rows={8}
              maxLength={BODY_MAX}
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
                {unknown.length > 1 ? "s" : ""} : {unknown.map((u) => `{{${u}}}`).join(", ")} —
                elle{unknown.length > 1 ? "s" : ""} partira{unknown.length > 1 ? "ont" : ""} telle
                {unknown.length > 1 ? "s" : ""} quelle{unknown.length > 1 ? "s" : ""}.
              </p>
            ) : null}
          </div>

          {/* ---------------- Aperçu ---------------- */}
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? "Masquer l’aperçu" : "Afficher l’aperçu"}
            </Button>
            {showPreview ? (
              <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
                {!recipient ? (
                  <p className="text-xs text-muted-foreground">
                    Choisissez un destinataire pour voir les variables remplacées.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">Sujet</p>
                <p className="text-sm font-medium">{previewSubject || "—"}</p>
                <p className="mt-3 text-xs text-muted-foreground">Message</p>
                <div className="mt-1 space-y-2 text-sm whitespace-pre-wrap">
                  {previewBody || "—"}
                </div>
              </div>
            ) : null}
          </div>

          {!canSend ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Aucun fournisseur e-mail n’est configuré sur ce serveur : l’envoi est
              désactivé tant que les variables d’environnement ne sont pas renseignées.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={onSend} disabled={!ready || pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                <Check />
                Envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
