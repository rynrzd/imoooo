"use client";

import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Building2,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { ActionCenter } from "@/components/dashboard/action-center";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PageHeader } from "@/components/layout/page-header";
import { PatrimonyMap } from "@/components/pilotage/patrimony-map";
import { StatCard } from "@/components/shared/stat-card";
import { FeatureGate } from "@/components/subscription/feature-gate";
import { currentMonthKey } from "@/lib/dates";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getOccupancyRate } from "@/lib/finance";
import {
  getActionItems,
  getMonthFinancials,
  getPortfolioValue,
} from "@/lib/insights";
import { useAppStore } from "@/lib/store";

/**
 * Centre de Pilotage Premium (Business+) — vue consolidée du patrimoine :
 * portefeuille, finances du mois, occupation, retards, carte interactive,
 * alertes et raccourcis. Données 100 % Supabase (via le store), aucune
 * valeur fictive. Le verrou d'affichage est doublé des contraintes serveur.
 */
export default function PilotagePage() {
  const { data } = useAppStore();

  const month = currentMonthKey();
  const current = getMonthFinancials(data, month);
  const actions = getActionItems(data);
  const occupancy = getOccupancyRate(data);
  const occupied = data.properties.filter((p) => p.status === "loue").length;
  const vacant = data.properties.filter((p) => p.status === "vacant").length;
  const lateCount = data.rentPayments.filter((p) => p.status === "retard").length;

  return (
    <>
      <PageHeader
        title="Centre de pilotage"
        description="Vue consolidée Business+ : patrimoine, finances, carte et alertes"
      />

      <FeatureGate feature="command_center" title="Centre de pilotage — plan Business+">
        <section
          aria-label="Indicateurs du patrimoine"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <StatCard
            label="Portefeuille global"
            value={formatCurrency(getPortfolioValue(data))}
            hint={`${data.properties.length} logement${data.properties.length > 1 ? "s" : ""}`}
            icon={Landmark}
            href="/logements"
          />
          <StatCard
            label="Revenus du mois"
            value={formatCurrency(current.revenue)}
            icon={TrendingUp}
            href="/loyers"
          />
          <StatCard
            label="Dépenses du mois"
            value={formatCurrency(current.expenses)}
            icon={Receipt}
            href="/statistiques"
          />
          <StatCard
            label="Cash-flow du mois"
            value={formatCurrency(current.cashflow)}
            icon={PiggyBank}
            tone={current.cashflow >= 0 ? "positive" : "negative"}
            href="/statistiques"
          />
          <StatCard
            label="Occupation"
            value={formatPercent(occupancy, 0)}
            progress={occupancy}
            hint={`${occupied} occupé${occupied > 1 ? "s" : ""} · ${vacant} vacant${vacant > 1 ? "s" : ""}`}
            icon={Building2}
            href="/logements"
          />
          <StatCard
            label="Loyers en retard"
            value={String(lateCount)}
            icon={AlertTriangle}
            tone={lateCount > 0 ? "warning" : "default"}
            hint={lateCount === 0 ? "aucun impayé en cours" : "à relancer rapidement"}
            href="/loyers"
          />
        </section>

        <FeatureGate feature="patrimony_map" title="Carte du patrimoine — plan Business+">
          <PatrimonyMap />
        </FeatureGate>

        <section
          aria-label="Alertes et raccourcis"
          className="grid grid-cols-1 gap-4 xl:grid-cols-3"
        >
          <div className="xl:col-span-2">
            <ActionCenter items={actions} />
          </div>
          <QuickActions />
        </section>
      </FeatureGate>
    </>
  );
}
