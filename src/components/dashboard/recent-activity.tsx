"use client";

import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Building2,
  Camera,
  FileText,
  Hammer,
  Receipt,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { ActivityItem, ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIVITY_ICONS: Record<ActivityType, { icon: LucideIcon; className: string }> = {
  paiement: { icon: Banknote, className: "bg-emerald-500/10 text-emerald-700" },
  retard: { icon: AlertCircle, className: "bg-red-500/10 text-red-700" },
  travaux: { icon: Hammer, className: "bg-blue-500/10 text-blue-700" },
  document: { icon: FileText, className: "bg-muted text-muted-foreground" },
  locataire: { icon: UserRound, className: "bg-violet-500/10 text-violet-700" },
  logement: { icon: Building2, className: "bg-primary/8 text-primary" },
  photo: { icon: Camera, className: "bg-cyan-500/10 text-cyan-700" },
  depense: { icon: Receipt, className: "bg-orange-500/10 text-orange-700" },
};

interface RecentActivityProps {
  items: ActivityItem[];
  limit?: number;
}

/**
 * Timeline d'activité du patrimoine : événements réels (logements,
 * locataires, paiements, documents, travaux, modifications) présentés
 * chronologiquement, reliés par un rail vertical.
 */
export function RecentActivity({ items, limit = 8 }: RecentActivityProps) {
  const visible = [...items]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Activité récente</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Aucune activité pour l&apos;instant : elle apparaîtra dès vos premières
            actions (loyers, documents, travaux…).
          </p>
        ) : null}
        <ol className="space-y-0">
          {visible.map((item, index) => {
            const config = ACTIVITY_ICONS[item.type];
            const isLast = index === visible.length - 1;
            const body = (
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-sm leading-snug text-foreground">
                  {item.message}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(item.date)}
                </span>
              </span>
            );

            return (
              <li key={item.id} className="flex gap-3">
                {/* Rail chronologique : pictogramme + connecteur vers l'événement suivant. */}
                <span className="flex flex-col items-center" aria-hidden>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      config.className
                    )}
                  >
                    <config.icon className="size-3.5" />
                  </span>
                  {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
                </span>
                {item.propertyId ? (
                  <Link
                    href={`/logements/${item.propertyId}`}
                    className="mb-1.5 flex min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-accent/60"
                  >
                    {body}
                  </Link>
                ) : (
                  <span className="mb-1.5 flex min-w-0 flex-1 px-2 py-1">{body}</span>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
