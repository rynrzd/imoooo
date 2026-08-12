"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Hammer, Home, Wallet, type LucideIcon } from "lucide-react";
import { ListRow, type ListRowTone } from "@/components/shared/list-row";
import type { ActionItem, ActionKind } from "@/lib/insights";

/**
 * « À faire » — uniquement ce qui demande une attention aujourd'hui.
 *
 * C'est le premier bloc utile du tableau de bord mobile : s'il est vide, il
 * le dit en une ligne et n'occupe pas un écran entier. Chaque ligne mène à
 * l'écran où l'action se règle vraiment — jamais un bouton sans suite.
 */

const ICONS: Record<ActionKind, LucideIcon> = {
  loyer_retard: AlertTriangle,
  loyer_partiel: Wallet,
  bail_bientot_termine: CalendarClock,
  logement_vacant: Home,
  document_manquant: FileText,
  document_expire: FileText,
  chantier_en_cours: Hammer,
};

/** Où va-t-on pour traiter cette action ? Toujours un écran réel. */
function destination(item: ActionItem): string {
  switch (item.kind) {
    case "loyer_retard":
    case "loyer_partiel":
      return "/loyers";
    case "bail_bientot_termine":
      return item.propertyId ? `/logements/${item.propertyId}?tab=location` : "/baux";
    case "logement_vacant":
      return item.propertyId ? `/logements/${item.propertyId}` : "/logements";
    case "document_manquant":
    case "document_expire":
      return item.propertyId ? `/logements/${item.propertyId}?tab=documents` : "/documents";
    case "chantier_en_cours":
      return item.propertyId ? `/logements/${item.propertyId}?tab=finances` : "/travaux";
  }
}

const TONES: Record<ActionItem["severity"], ListRowTone> = {
  critique: "danger",
  important: "warning",
  info: "default",
};

export function TodayTasks({ items, limit = 4 }: { items: ActionItem[]; limit?: number }) {
  const visible = items.slice(0, limit);

  return (
    <section aria-labelledby="a-faire" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="a-faire" className="text-sm font-medium text-foreground">
          À faire
        </h2>
        {items.length > visible.length ? (
          <Link
            href="/pilotage"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Tout voir ({items.length})
          </Link>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          Rien ne demande votre attention aujourd&apos;hui.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((item) => (
            <ListRow
              key={item.id}
              icon={ICONS[item.kind]}
              href={destination(item)}
              title={item.title}
              subtitle={item.description}
              tone={TONES[item.severity]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
