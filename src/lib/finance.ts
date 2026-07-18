import type { AppData, Property, RentPayment, Tenant } from "./types";
import { currentMonthKey, lastMonths, yearOf } from "./dates";

/**
 * Sélecteurs financiers purs : toutes les statistiques de l'application
 * sont dérivées des données brutes, jamais stockées en double.
 */

export interface DashboardStats {
  propertyCount: number;
  activeTenantCount: number;
  monthExpected: number;
  monthReceived: number;
  lateCount: number;
  yearRevenue: number;
  yearExpenses: number;
  yearNet: number;
}

export interface MonthlyPoint {
  month: string;
  revenus: number;
  depenses: number;
}

export interface PropertyFinancials {
  totalRevenue: number;
  totalExpenses: number;
  net: number;
  /** Rendement brut : loyer annuel (hors charges) / prix d'achat. */
  grossYield: number;
}

export function isActiveTenant(tenant: Tenant): boolean {
  return tenant.exitDate === null;
}

export function tenantFullName(tenant: Tenant): string {
  return `${tenant.firstName} ${tenant.lastName}`;
}

export function getDashboardStats(data: AppData): DashboardStats {
  const current = currentMonthKey();
  const year = yearOf(current);

  const monthPayments = data.rentPayments.filter((p) => p.month === current);
  const monthExpected = sum(monthPayments.map((p) => p.expected));
  const monthReceived = sum(monthPayments.map((p) => p.received));
  const lateCount = data.rentPayments.filter((p) => p.status === "retard").length;

  const yearRevenue = sum(
    data.rentPayments.filter((p) => yearOf(p.month) === year).map((p) => p.received)
  );
  const yearExpenses = sum(
    data.expenses.filter((e) => yearOf(e.date.slice(0, 7)) === year).map((e) => e.amount)
  );

  return {
    propertyCount: data.properties.length,
    activeTenantCount: data.tenants.filter(isActiveTenant).length,
    monthExpected,
    monthReceived,
    lateCount,
    yearRevenue,
    yearExpenses,
    yearNet: yearRevenue - yearExpenses,
  };
}

/** Série mensuelle revenus / dépenses sur les n derniers mois. */
export function getMonthlySeries(data: AppData, months = 12): MonthlyPoint[] {
  return lastMonths(months).map((month) => ({
    month,
    revenus: sum(
      data.rentPayments.filter((p) => p.month === month).map((p) => p.received)
    ),
    depenses: sum(
      data.expenses.filter((e) => e.date.startsWith(month)).map((e) => e.amount)
    ),
  }));
}

/** Bilan financier complet d'un logement (depuis l'acquisition des données). */
export function getPropertyFinancials(
  data: AppData,
  property: Property
): PropertyFinancials {
  const totalRevenue = sum(
    data.rentPayments
      .filter((p) => p.propertyId === property.id)
      .map((p) => p.received)
  );
  const totalExpenses = sum(
    data.expenses.filter((e) => e.propertyId === property.id).map((e) => e.amount)
  );
  return {
    totalRevenue,
    totalExpenses,
    net: totalRevenue - totalExpenses,
    // Garde-fou : un prix d'achat à 0 ne doit jamais produire Infinity/NaN.
    grossYield:
      property.purchasePrice > 0
        ? (property.rent * 12 * 100) / property.purchasePrice
        : 0,
  };
}

/** Revenus encaissés par logement sur les 12 derniers mois. */
export function getRevenueByProperty(
  data: AppData
): { property: Property; revenue: number }[] {
  const window = new Set(lastMonths(12));
  return data.properties
    .map((property) => ({
      property,
      revenue: sum(
        data.rentPayments
          .filter((p) => p.propertyId === property.id && window.has(p.month))
          .map((p) => p.received)
      ),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Loyers d'un logement, du plus récent au plus ancien. */
export function getPropertyPayments(data: AppData, propertyId: string): RentPayment[] {
  return data.rentPayments.filter((p) => p.propertyId === propertyId);
}

/** Totaux annuels d'une liste de loyers (année du mois courant). */
export function getYearRentTotals(payments: RentPayment[]): {
  expected: number;
  received: number;
} {
  const year = yearOf(currentMonthKey());
  const inYear = payments.filter((p) => yearOf(p.month) === year);
  return {
    expected: sum(inYear.map((p) => p.expected)),
    received: sum(inYear.map((p) => p.received)),
  };
}

/** Date du dernier encaissement d'un logement (null si aucun). */
export function getLastPaymentDate(data: AppData, propertyId: string): string | null {
  return (
    data.rentPayments
      .filter((p) => p.propertyId === propertyId && p.paidAt !== null)
      .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0]?.paidAt ??
    null
  );
}

export function getTenant(data: AppData, tenantId: string | null): Tenant | null {
  if (!tenantId) return null;
  return data.tenants.find((t) => t.id === tenantId) ?? null;
}

export function getProperty(data: AppData, propertyId: string | null): Property | null {
  if (!propertyId) return null;
  return data.properties.find((p) => p.id === propertyId) ?? null;
}

/** Taux d'occupation actuel du parc (logements loués / total). */
export function getOccupancyRate(data: AppData): number {
  if (data.properties.length === 0) return 0;
  const rented = data.properties.filter((p) => p.status === "loue").length;
  return (rented * 100) / data.properties.length;
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
