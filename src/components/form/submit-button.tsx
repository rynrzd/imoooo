"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Action principale d'un formulaire — dominante, pleine largeur, 48 px.
 *
 * Elle porte elle-même la protection contre le double clic : `pending` la
 * désactive, et le `disabled` d'un bouton natif ignore aussi la touche Entrée
 * répétée. Aucun appelant n'a donc à réinventer ce garde-fou.
 *
 * Les trois états sont visibles : au repos, pendant l'envoi, après succès.
 */
export function SubmitButton({
  children,
  pending = false,
  done = false,
  pendingLabel = "Enregistrement…",
  doneLabel,
  disabled,
  type = "submit",
  onClick,
  className,
}: {
  children: React.ReactNode;
  pending?: boolean;
  /** Succès confirmé (affiché brièvement avant la navigation). */
  done?: boolean;
  pendingLabel?: string;
  doneLabel?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending || done || disabled}
      aria-busy={pending || undefined}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.625rem] bg-primary px-4 text-[0.95rem] font-semibold text-primary-foreground",
        "transition-[opacity,transform] duration-200 outline-none",
        "hover:opacity-95 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:translate-y-px disabled:opacity-60 disabled:active:translate-y-0",
        className
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : done ? (
        <>
          <Check className="size-4" aria-hidden />
          {doneLabel ?? "Enregistré"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
