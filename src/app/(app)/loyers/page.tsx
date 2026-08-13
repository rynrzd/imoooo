"use client";

import * as React from "react";
import { ArrowDownToLine, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CollectRentSheet } from "@/components/rents/collect-rent-sheet";
import { RentList } from "@/components/rents/rent-list";
import { RentTable } from "@/components/rents/rent-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSheet } from "@/components/shared/filter-sheet";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { StatCard } from "@/components/shared/stat-card";
import { currentMonthKey, yearOf } from "@/lib/dates";
import { getYearRentTotals } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { useAppStore } from "@/lib/store";

/**
 * Loyers — une échéance par ligne au doigt, le tableau complet au bureau.
 *
 * Le filtre par logement est passé dans une feuille (il n'y en a qu'un, mais
 * il occupait la moitié de l'en-tête sur téléphone). Les totaux restent
 * calculés sur la liste complète : seul l'affichage est paginé.
 */
export default function RentsPage() {
  const { data } = useAppStore();
  const [propertyFilter, setPropertyFilter] = React.useState<string>("tous");
  const [collectOpen, setCollectOpen] = React.useState(false);

  const payments =
    propertyFilter === "tous"
      ? data.rentPayments
      : data.rentPayments.filter((p) => p.propertyId === propertyFilter);

  const totals = getYearRentTotals(payments);
  const year = yearOf(currentMonthKey());
  const { pageItems, page, pageCount, setPage, total } = usePagination(payments, 24);

  return (
    <>
      <PageHeader title="Loyers">
        {/* L'action principale de cet écran : encaisser. Elle ouvre la feuille
            partagée, la même que depuis le tableau de bord. */}
        {data.rentPayments.some((p) => p.received < p.expected) ? (
          <>
            <button
              type="button"
              onClick={() => setCollectOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[0.625rem] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-95"
            >
              <Plus className="size-4" aria-hidden />
              Ajouter un encaissement
            </button>
            {collectOpen ? (
              <CollectRentSheet open onOpenChange={setCollectOpen} />
            ) : null}
          </>
        ) : null}
        {data.properties.length > 1 ? (
          <FilterSheet
            label="Logement"
            activeCount={propertyFilter === "tous" ? 0 : 1}
            onReset={() => setPropertyFilter("tous")}
            groups={[
              {
                label: "Logement",
                value: propertyFilter,
                onChange: setPropertyFilter,
                options: [
                  { value: "tous", label: "Tous les logements" },
                  ...data.properties.map((p) => ({ value: p.id, label: p.name })),
                ],
              },
            ]}
          />
        ) : null}
      </PageHeader>

      {data.rentPayments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aucune échéance pour l'instant."
          description="Les loyers apparaîtront automatiquement, mois après mois, dès qu'un bail sera actif sur l'un de vos logements."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label={`Total annuel prévu (${year})`}
              value={formatCurrency(totals.expected)}
              icon={Wallet}
            />
            <StatCard
              label="Total encaissé"
              value={formatCurrency(totals.received)}
              hint={`sur ${formatCurrency(totals.expected)} prévus`}
              icon={ArrowDownToLine}
              tone="positive"
              progress={totals.expected > 0 ? (totals.received * 100) / totals.expected : 0}
            />
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aucune échéance pour ce logement"
              description="Changez de filtre pour retrouver vos autres échéances."
            />
          ) : (
            <>
              <div className="lg:hidden">
                <RentList payments={pageItems} showProperty={propertyFilter === "tous"} />
              </div>
              <div className="max-lg:hidden">
                <RentTable payments={pageItems} showProperty={propertyFilter === "tous"} />
              </div>
              <PaginationBar
                page={page}
                pageCount={pageCount}
                total={total}
                onPageChange={setPage}
                label="échéances"
              />
            </>
          )}
        </>
      )}
    </>
  );
}
