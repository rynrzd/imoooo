"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toUserMessage } from "./errors";
import { cn } from "@/lib/utils";

/**
 * CONFIRMATION D'UNE ACTION DESTRUCTIVE — la seule de l'application.
 *
 * Elle dit toujours quatre choses : QUOI est concerné, CE QUI disparaît avec,
 * CE QUI est conservé, et si l'action est réversible. Le rouge n'apparaît
 * qu'ICI : nulle part ailleurs dans l'interface un bouton n'est rouge.
 *
 * Une saisie de confirmation (`confirmWord`) peut être exigée pour les
 * suppressions les plus lourdes — jamais pour une simple ligne.
 */
export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  target,
  consequences,
  preserved,
  irreversible = true,
  confirmLabel = "Supprimer définitivement",
  confirmWord,
  extra,
  blocked = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** « Supprimer ce logement ? » */
  title: string;
  /** Nom exact de l'élément concerné. */
  target: string;
  /** Ce qui est supprimé en même temps (relations). */
  consequences?: string[];
  /** Ce qui N'EST PAS supprimé (rassure autant que le reste). */
  preserved?: string[];
  irreversible?: boolean;
  confirmLabel?: string;
  /** Mot à saisir pour débloquer le bouton (suppressions lourdes). */
  confirmWord?: string;
  /** Champ supplémentaire exigé par l'appelant (ex. mot de passe du compte). */
  extra?: React.ReactNode;
  /** L'appelant bloque encore la confirmation (son champ n'est pas rempli). */
  blocked?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Chaque ouverture repart d'un état propre. Différé d'un tick : aucun
  // setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setTyped("");
      setError(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const locked = blocked || (confirmWord ? typed.trim() !== confirmWord : false);

  const run = async () => {
    if (busy || locked) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(toUserMessage(e, "Suppression impossible. Réessayez."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Une suppression en cours ne se referme pas par mégarde.
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="nireo-form max-w-md">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-semibold tracking-[-0.02em]">
              {title}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{target}</span>
              {irreversible
                ? " — cette action est définitive et ne peut pas être annulée."
                : " — vous pourrez revenir en arrière."}
            </p>
          </div>

          {consequences && consequences.length > 0 ? (
            <div className="rounded-[0.625rem] bg-danger-soft px-3 py-2.5">
              <p className="text-xs font-medium text-danger">
                Seront supprimés en même temps
              </p>
              <ul className="mt-1 space-y-0.5">
                {consequences.map((item) => (
                  <li key={item} className="text-xs text-danger">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preserved && preserved.length > 0 ? (
            <div className="px-1">
              <p className="text-xs font-medium text-foreground">Sont conservés</p>
              <ul className="mt-1 space-y-0.5">
                {preserved.map((item) => (
                  <li key={item} className="text-xs text-muted-foreground">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {confirmWord ? (
            <div className="space-y-2">
              <label
                htmlFor="confirm-word"
                className="block text-sm font-medium text-foreground"
              >
                Saisissez « {confirmWord} » pour confirmer
              </label>
              <input
                id="confirm-word"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full border border-input bg-card text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
          ) : null}

          {extra}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy || locked}
              aria-busy={busy || undefined}
              className={cn(
                "flex min-h-12 w-full items-center justify-center rounded-[0.625rem] bg-danger px-4 text-[0.95rem] font-semibold text-white",
                "transition-opacity duration-200 outline-none hover:opacity-90",
                "focus-visible:ring-3 focus-visible:ring-danger/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:opacity-50"
              )}
            >
              {busy ? "Suppression…" : confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="mx-auto min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
