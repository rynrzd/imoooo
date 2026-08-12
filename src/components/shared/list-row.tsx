"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ligne de liste — la brique de lecture de l'application sur téléphone.
 *
 * Elle remplace les tableaux desktop compressés et l'empilement de grandes
 * cartes identiques : un titre, un sous-titre, une valeur à droite, un filet
 * fin en dessous. Rien de décoratif.
 *
 * - hauteur minimale de 56 px : la cible tactile dépasse les 44 px exigés ;
 * - `href` la rend cliquable en entier (et non un petit lien au milieu) ;
 * - `actions` reçoit le menu « … » d'une ligne, qui ne déclenche jamais le
 *   lien parent (le conteneur arrête la propagation) ;
 * - le ton ne repose jamais sur la couleur seule : le texte le dit aussi.
 */

export type ListRowTone = "default" | "positive" | "warning" | "danger";

const TONES: Record<ListRowTone, string> = {
  default: "text-muted-foreground",
  positive: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-400",
};

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Valeur alignée à droite (montant, statut court…). */
  value?: string;
  /** Précision sous la valeur, ou sous le titre si aucune valeur. */
  hint?: string;
  tone?: ListRowTone;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  /** Menu d'actions de la ligne. */
  actions?: React.ReactNode;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  value,
  hint,
  tone = "default",
  icon: Icon,
  href,
  onClick,
  actions,
  className,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);

  const body = (
    <>
      {Icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
        {!value && hint ? (
          <span className={cn("block truncate text-xs", TONES[tone])}>{hint}</span>
        ) : null}
      </span>

      {value ? (
        <span className="shrink-0 text-right">
          <span className="block text-sm font-medium tabular-nums text-foreground">{value}</span>
          {hint ? <span className={cn("block text-xs", TONES[tone])}>{hint}</span> : null}
        </span>
      ) : null}

      {href && !actions ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
      ) : null}
    </>
  );

  const shared = cn(
    "flex min-h-14 w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0",
    interactive && "transition-colors duration-200 hover:bg-accent/50",
    className
  );

  return (
    <div className="relative flex items-center last:[&>*]:border-b-0">
      {href ? (
        <Link href={href} className={shared}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={shared}>
          {body}
        </button>
      ) : (
        <div className={shared}>{body}</div>
      )}

      {actions ? (
        <div
          className="absolute inset-y-0 right-1 flex items-center"
          // Le menu vit au-dessus du lien : un appui dessus ne navigue pas.
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
