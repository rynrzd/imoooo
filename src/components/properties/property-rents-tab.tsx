"use client";

import { AlertTriangle, ArrowDownToLine, Wallet } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { REVENUE_SERIES } from "@/components/charts/chart-theme";
import { MonthlyBarChart } from "@/components/charts/lazy";
import { RentTable } from "@/components/rents/rent-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { lastMonths } from "@/lib/dates";
import { getPropertyPayments } from "@/lib/finance";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Property } from "@/lib/types";

interface PropertyRentsTabProps {
  property: Property;
}

/** Onglet « Loyers » : résumé, évolution sur 12 mois, échéancier complet. */
export function PropertyRentsTab({ property }: PropertyRentsTabProps) {
  const { data } = useAppStore();
  const payments = getPropertyPayments(data, property.id);

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Aucun loyer enregistré"
        description="L'historique des loyers apparaîtra dès qu'un locataire sera en place."
      />
    );
  }

  const expected = payments.reduce((acc, p) => acc + p.expected, 0);
  const received = payments.reduce((acc, p) => acc + p.received, 0);
  const remaining = expected - received;
  const collectionRate = expected > 0 ? (received * 100) / expected : 0;
  const lateCount = payments.filter((p) => p.status === "retard").length;

  // Évolution des encaissements sur 12 mois.
  const monthly = lastMonths(12).map((month) => ({
    month,
    revenus: payments
      .filter((p) => p.month === month)
      .reduce((acc, p) => acc + p.received, 0),
    depenses: 0,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total attendu"
          value={formatCurrency(expected)}
          icon={Wallet}
        />
        <StatCard
          label="Total encaissé"
          value={formatCurrency(received)}
          hint={`taux d'encaissement : ${formatPercent(collectionRate)}`}
          icon={ArrowDownToLine}
          tone="positive"
          progress={collectionRate}
        />
        <StatCard
          label="Restant dû"
          value={formatCurrency(remaining)}
          icon={Wallet}
          tone={remaining > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Loyers en retard"
          value={String(lateCount)}
          icon={AlertTriangle}
          tone={lateCount > 0 ? "negative" : "default"}
        />
      </div>

      <ChartCard
        title="Encaissements sur 12 mois"
        description="Loyers reçus mois par mois pour ce logement"
      >
        <MonthlyBarChart data={monthly} series={[REVENUE_SERIES]} height={220} />
      </ChartCard>

      <RentTable payments={payments} />
    </div>
  );
}
