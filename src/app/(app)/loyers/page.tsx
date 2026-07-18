"use client";

import * as React from "react";
import { ArrowDownToLine, Wallet } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { RentTable } from "@/components/rents/rent-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { StatCard } from "@/components/shared/stat-card";
import { currentMonthKey, yearOf } from "@/lib/dates";
import { getYearRentTotals } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { useAppStore } from "@/lib/store";

export default function RentsPage() {
  const { data } = useAppStore();
  const [propertyFilter, setPropertyFilter] = React.useState<string>("tous");

  const payments =
    propertyFilter === "tous"
      ? data.rentPayments
      : data.rentPayments.filter((p) => p.propertyId === propertyFilter);

  const totals = getYearRentTotals(payments);
  const year = yearOf(currentMonthKey());
  // Les totaux sont calculés sur la liste complète ; seul l'affichage est paginé.
  const { pageItems, page, pageCount, setPage, total } = usePagination(payments, 24);

  return (
    <>
      <PageHeader
        title="Loyers"
        description="Historique mensuel des loyers de votre patrimoine"
      >
        <Select
          value={propertyFilter}
          onValueChange={(value) => setPropertyFilter(value as string)}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les logements</SelectItem>
            {data.properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

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
          title="Aucun loyer enregistré"
          description="Les échéances apparaîtront dès qu'un bail sera actif sur un logement."
        />
      ) : (
        <>
          <RentTable payments={pageItems} showProperty={propertyFilter === "tous"} />
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
  );
}
