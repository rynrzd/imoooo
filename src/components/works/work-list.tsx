"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CalendarClock,
  FileText,
  Hammer,
  ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { WorkStatusBadge } from "@/components/shared/status-badge";
import { getProperty } from "@/lib/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Work, WorkStatus } from "@/lib/types";
import { EditWorkDialog } from "./edit-work-dialog";

interface WorkListProps {
  works: Work[];
  showProperty?: boolean;
}

/** Avancement visuel d'un chantier selon son statut. */
const STATUS_PROGRESS: Record<WorkStatus, number> = {
  planifie: 10,
  en_cours: 55,
  termine: 100,
};

const STATUS_PROGRESS_CLASS: Record<WorkStatus, string> = {
  planifie: "bg-muted-foreground/50",
  en_cours: "bg-blue-600",
  termine: "bg-emerald-600",
};

const GROUPS: { status: WorkStatus; title: string }[] = [
  { status: "en_cours", title: "En cours" },
  { status: "planifie", title: "Planifiés" },
  { status: "termine", title: "Terminés" },
];

function WorkCard({ work, showProperty }: { work: Work; showProperty: boolean }) {
  const { data } = useAppStore();
  const property = getProperty(data, work.propertyId);
  const invoice = work.invoiceDocumentId
    ? data.documents.find((d) => d.id === work.invoiceDocumentId)
    : null;

  return (
    <Card className="card-lift py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{work.title}</p>
              <WorkStatusBadge status={work.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {showProperty && property ? (
                <Link
                  href={`/logements/${property.id}`}
                  className="flex items-center gap-1 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  <Building2 className="size-3" />
                  {property.name}
                </Link>
              ) : null}
              <span className="flex items-center gap-1">
                <Hammer className="size-3" />
                {work.company}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                {formatDate(work.date)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-base font-semibold tabular-nums text-foreground">
                {formatCurrency(work.actualCost ?? work.amount)}
              </p>
              {work.actualCost !== null && work.actualCost !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  budget : {formatCurrency(work.amount)}
                </p>
              ) : null}
            </div>
            <EditWorkDialog work={work} />
          </div>
        </div>

        <Progress
          value={work.progress ?? STATUS_PROGRESS[work.status]}
          indicatorClassName={STATUS_PROGRESS_CLASS[work.status]}
          aria-label={`Avancement — ${work.title}`}
        />

        {invoice || work.photoIds.length > 0 || work.endDate ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {work.endDate ? (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3" />
                fin prévue le {formatDate(work.endDate)}
              </span>
            ) : null}
            {invoice ? (
              <span className="flex items-center gap-1">
                <FileText className="size-3" />
                {invoice.name}
              </span>
            ) : null}
            {work.photoIds.length > 0 ? (
              <span className="flex items-center gap-1">
                <ImageIcon className="size-3" />
                {work.photoIds.length} photo{work.photoIds.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Suivi de chantiers, groupés par état d'avancement. */
export function WorkList({ works, showProperty = false }: WorkListProps) {
  if (works.length === 0) {
    return (
      <EmptyState
        icon={Hammer}
        title="Aucuns travaux enregistrés"
        description="Ajoutez vos chantiers pour suivre leur coût et conserver les factures."
      />
    );
  }

  const groups = GROUPS.map((group) => ({
    ...group,
    items: works
      .filter((w) => w.status === group.status)
      .sort((a, b) => b.date.localeCompare(a.date)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.status} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {group.title}
            <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium tabular-nums">
              {group.items.length}
            </span>
          </h2>
          <div className="space-y-3">
            {group.items.map((work) => (
              <WorkCard key={work.id} work={work} showProperty={showProperty} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
