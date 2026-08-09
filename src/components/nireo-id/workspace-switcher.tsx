"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Loader2, Plus, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { WORKSPACE_KIND_LABELS, type WorkspaceKind } from "@/features/nireo-id/constants";
import { switchWorkspaceAction } from "@/features/nireo-id/actions/workspace";
import { cn } from "@/lib/utils";

/**
 * Sélecteur d'espace : personnel, entreprises, ateliers.
 * Le changement passe par une Server Action qui revérifie l'appartenance :
 * le cookie n'ouvre aucun droit à lui seul.
 */

export interface SwitcherItem {
  id: string;
  name: string;
  kind: WorkspaceKind;
}

const ICONS: Record<WorkspaceKind, typeof User> = {
  personnel: User,
  entreprise: Building2,
  atelier: Wrench,
};

export function WorkspaceSwitcher({
  items,
  activeId,
  className,
}: {
  items: SwitcherItem[];
  activeId: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;
  if (!active) return null;

  const ActiveIcon = ICONS[active.kind];

  const choose = async (id: string) => {
    if (pending) return;
    setPending(id);
    const form = new FormData();
    form.set("workspace_id", id);
    const result = await switchWorkspaceAction(form);
    setPending(null);
    setOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push(result.data.href);
    router.refresh();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        <ActiveIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{active.name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {WORKSPACE_KIND_LABELS[active.kind]}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute z-50 mt-1 w-full min-w-56 rounded-xl border border-border bg-card p-1 shadow-md"
        >
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => choose(item.id)}
                disabled={pending !== null}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                {pending === item.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                ) : item.id === active.id ? (
                  <Check className="size-4 text-primary" aria-hidden />
                ) : null}
              </button>
            );
          })}

          <a
            href="/id/app/espaces/nouveau"
            role="menuitem"
            className="mt-1 flex items-center gap-2.5 rounded-lg border-t border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Créer un espace
          </a>
        </div>
      ) : null}
    </div>
  );
}
