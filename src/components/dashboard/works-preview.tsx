"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkStatusBadge } from "@/components/shared/status-badge";
import { getProperty } from "@/lib/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { WorkStatus } from "@/lib/types";

const STATUS_PROGRESS: Record<WorkStatus, number> = {
  planifie: 10,
  en_cours: 55,
  termine: 100,
};

/** Aperçu compact des chantiers actifs (ou à venir). */
export function WorksPreview() {
  const { data } = useAppStore();
  const active = data.works
    .filter((w) => w.status === "en_cours")
    .sort((a, b) => b.date.localeCompare(a.date));
  const planned = data.works
    .filter((w) => w.status === "planifie")
    .sort((a, b) => a.date.localeCompare(b.date));
  const visible = [...active, ...planned].slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Travaux en cours</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/travaux" />}>
            Tout voir
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 px-3 py-4 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Aucun chantier en cours.
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map((work) => {
              const property = getProperty(data, work.propertyId);
              return (
                <li key={work.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">
                      {work.title}
                    </p>
                    <WorkStatusBadge status={work.status} />
                  </div>
                  <Progress
                    value={STATUS_PROGRESS[work.status]}
                    indicatorClassName={
                      work.status === "en_cours"
                        ? "bg-blue-600"
                        : "bg-muted-foreground/50"
                    }
                    aria-label={`Avancement — ${work.title}`}
                  />
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      property?.name,
                      `budget ${formatCurrency(work.amount)}`,
                      formatDate(work.date),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
