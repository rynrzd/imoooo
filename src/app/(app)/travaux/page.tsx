"use client";

import { CheckCircle2, Hammer, Timer, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { StatCard } from "@/components/shared/stat-card";
import { AddWorkDialog } from "@/components/works/add-work-dialog";
import { WorkList } from "@/components/works/work-list";
import { formatCurrency } from "@/lib/format";
import { useAppStore } from "@/lib/store";

export default function WorksPage() {
  const { data } = useAppStore();
  const total = data.works.reduce((acc, w) => acc + w.amount, 0);
  const inProgress = data.works.filter((w) => w.status === "en_cours");
  const done = data.works.filter((w) => w.status === "termine");
  const committed = inProgress.reduce((acc, w) => acc + w.amount, 0);
  // Les totaux couvrent tout ; seul l'affichage de la liste est paginé.
  const { pageItems, page, pageCount, setPage, total: workCount } = usePagination(data.works, 20);

  return (
    <>
      <PageHeader
        title="Travaux"
        description="Suivi des chantiers et réparations de votre parc"
      >
        <AddWorkDialog />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chantiers" value={String(data.works.length)} icon={Hammer} />
        <StatCard
          label="En cours"
          value={String(inProgress.length)}
          hint={
            inProgress.length > 0
              ? `${formatCurrency(committed)} engagés`
              : "aucun chantier actif"
          }
          icon={Timer}
          tone={inProgress.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Terminés"
          value={String(done.length)}
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard
          label="Budget total"
          value={formatCurrency(total)}
          hint="comptabilisé dans vos dépenses"
          icon={Wallet}
          tone="negative"
        />
      </div>

      <WorkList works={pageItems} showProperty />
      <PaginationBar
        page={page}
        pageCount={pageCount}
        total={workCount}
        onPageChange={setPage}
        label="chantiers"
      />
    </>
  );
}
