import type { AppData, Property, RentPayment } from "./types";
import { currentMonthKey } from "./dates";
import { formatDate } from "./format";
import {
  getLastPaymentDate,
  getOccupancyRate,
  getPropertyFinancials,
  getTenant,
} from "./finance";

/**
 * Sélecteurs du cockpit : santé du patrimoine, actions à traiter,
 * logements prioritaires. Règles simples et explicites, dérivées
 * uniquement des données existantes.
 */

export interface MonthFinancials {
  revenue: number;
  expenses: number;
  cashflow: number;
}

/** Revenus, dépenses et cash-flow d'un mois "yyyy-mm". */
export function getMonthFinancials(data: AppData, monthKey: string): MonthFinancials {
  const revenue = sum(
    data.rentPayments.filter((p) => p.month === monthKey).map((p) => p.received)
  );
  const expenses = sum(
    data.expenses.filter((e) => e.date.startsWith(monthKey)).map((e) => e.amount)
  );
  return { revenue, expenses, cashflow: revenue - expenses };
}

/** Valeur du patrimoine : prix d'acquisition cumulés. */
export function getPortfolioValue(data: AppData): number {
  return sum(data.properties.map((p) => p.purchasePrice));
}

/** Rendement brut moyen du parc. */
export function getAverageGrossYield(data: AppData): number {
  if (data.properties.length === 0) return 0;
  return (
    sum(data.properties.map((p) => getPropertyFinancials(data, p).grossYield)) /
    data.properties.length
  );
}

/** Variation en % entre deux valeurs (null si la base est nulle). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) * 100) / previous;
}

/* ------------------------------------------------------------------ */
/* Documents attendus pour un logement loué                            */
/* ------------------------------------------------------------------ */

export interface MissingDocument {
  property: Property;
  /** Catégorie attendue absente du dossier. */
  category: "bail" | "assurance";
  label: string;
}

/** Bail et assurance attendus pour chaque logement occupé. */
export function getMissingDocuments(data: AppData): MissingDocument[] {
  const missing: MissingDocument[] = [];
  for (const property of data.properties) {
    if (!property.currentTenantId) continue;
    const categories = new Set(
      data.documents.filter((d) => d.propertyId === property.id).map((d) => d.category)
    );
    if (!categories.has("bail")) {
      missing.push({ property, category: "bail", label: "Bail" });
    }
    if (!categories.has("assurance")) {
      missing.push({
        property,
        category: "assurance",
        label: "Attestation d'assurance",
      });
    }
  }
  return missing;
}

/* ------------------------------------------------------------------ */
/* Centre d'actions                                                    */
/* ------------------------------------------------------------------ */

export type ActionKind =
  | "loyer_retard"
  | "loyer_partiel"
  | "bail_bientot_termine"
  | "logement_vacant"
  | "document_manquant"
  | "document_expire"
  | "chantier_en_cours";

export type ActionSeverity = "critique" | "important" | "info";

/** Niveau d'alerte par type d'action (affichage + tri). */
export const ACTION_SEVERITY: Record<ActionKind, ActionSeverity> = {
  loyer_retard: "critique",
  loyer_partiel: "important",
  bail_bientot_termine: "important",
  document_expire: "important",
  logement_vacant: "important",
  document_manquant: "info",
  chantier_en_cours: "info",
};

export interface ActionItem {
  id: string;
  kind: ActionKind;
  severity: ActionSeverity;
  title: string;
  description: string;
  propertyId: string | null;
  /** Locataire concerné (actions de type bail). */
  tenantId?: string;
  /** Échéance concernée (actions de type loyer). */
  payment?: RentPayment;
}

/** Actions concrètes à traiter, triées par urgence. */
export function getActionItems(data: AppData): ActionItem[] {
  const items: Omit<ActionItem, "severity">[] = [];
  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Logement";

  for (const payment of data.rentPayments) {
    if (payment.status !== "retard" && payment.status !== "partiel") continue;
    const tenant = getTenant(data, payment.tenantId);
    const remaining = payment.expected - payment.received;
    items.push({
      id: `paiement-${payment.id}`,
      kind: payment.status === "retard" ? "loyer_retard" : "loyer_partiel",
      title:
        payment.status === "retard"
          ? `Loyer en retard — ${propertyName(payment.propertyId)}`
          : `Paiement partiel — ${propertyName(payment.propertyId)}`,
      description: `${tenant ? `${tenant.firstName} ${tenant.lastName} · ` : ""}reste dû : ${remaining} €`,
      propertyId: payment.propertyId,
      payment,
    });
  }

  for (const property of data.properties) {
    if (property.status === "vacant") {
      items.push({
        id: `vacant-${property.id}`,
        kind: "logement_vacant",
        title: `Logement vacant — ${property.name}`,
        description: "Aucun loyer perçu tant qu'un locataire n'est pas en place.",
        propertyId: property.id,
      });
    }
  }

  for (const missing of getMissingDocuments(data)) {
    items.push({
      id: `document-${missing.property.id}-${missing.category}`,
      kind: "document_manquant",
      title: `${missing.label} manquant — ${missing.property.name}`,
      description: "Le dossier administratif du logement est incomplet.",
      propertyId: missing.property.id,
    });
  }

  // Documents expirés ou expirant sous 30 jours (assurance, diagnostics…).
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  const soonIso = soon.toISOString().slice(0, 10);

  // Baux se terminant sous 60 jours (date de sortie déjà planifiée) :
  // anticiper l'état des lieux de sortie et la relocation.
  const leaseHorizon = new Date(today);
  leaseHorizon.setDate(leaseHorizon.getDate() + 60);
  const leaseHorizonIso = leaseHorizon.toISOString().slice(0, 10);
  for (const tenant of data.tenants) {
    if (!tenant.exitDate || tenant.exitDate < todayIso || tenant.exitDate > leaseHorizonIso) {
      continue;
    }
    items.push({
      id: `bail-${tenant.id}`,
      kind: "bail_bientot_termine",
      title: `Bail bientôt terminé — ${propertyName(tenant.propertyId)}`,
      description: `${tenant.firstName} ${tenant.lastName} · sortie prévue le ${formatDate(tenant.exitDate)}`,
      propertyId: tenant.propertyId,
      tenantId: tenant.id,
    });
  }
  for (const document of data.documents) {
    if (!document.expiresAt || document.expiresAt > soonIso) continue;
    const expired = document.expiresAt < todayIso;
    items.push({
      id: `expire-${document.id}`,
      kind: "document_expire",
      title: `${document.name} — ${expired ? "expiré" : "expire bientôt"}`,
      description: `${propertyName(document.propertyId)} · ${expired ? "à renouveler sans attendre" : `échéance le ${document.expiresAt}`}`,
      propertyId: document.propertyId,
    });
  }

  for (const work of data.works) {
    if (work.status !== "en_cours") continue;
    items.push({
      id: `chantier-${work.id}`,
      kind: "chantier_en_cours",
      title: `Chantier en cours — ${propertyName(work.propertyId)}`,
      description: `${work.title} · ${work.company}`,
      propertyId: work.propertyId,
    });
  }

  const priority: Record<ActionKind, number> = {
    loyer_retard: 0,
    loyer_partiel: 1,
    bail_bientot_termine: 2,
    document_expire: 3,
    logement_vacant: 4,
    document_manquant: 5,
    chantier_en_cours: 6,
  };
  return items
    .map((item) => ({ ...item, severity: ACTION_SEVERITY[item.kind] }))
    .sort((a, b) => priority[a.kind] - priority[b.kind]);
}

/* ------------------------------------------------------------------ */
/* Santé du patrimoine                                                 */
/* ------------------------------------------------------------------ */

export interface HealthFactor {
  id: string;
  /** true = point positif, false = point d'attention. */
  ok: boolean;
  label: string;
}

export interface HealthReport {
  /** Score de 0 à 100. */
  score: number;
  label: "Excellent" | "Bon" | "À surveiller" | "Fragile";
  factors: HealthFactor[];
}

/**
 * Score de santé — barème simple et explicite :
 * retards −10 (max −30), partiels −4 (max −12), vacance proportionnelle
 * (max −20), cash-flow mensuel négatif −10, documents manquants −3
 * (max −12), chantiers actifs −2 (max −6).
 */
export function getHealthReport(data: AppData): HealthReport {
  const month = currentMonthKey();
  const factors: HealthFactor[] = [];
  let score = 100;

  const late = data.rentPayments.filter((p) => p.status === "retard").length;
  const partial = data.rentPayments.filter((p) => p.status === "partiel").length;
  score -= Math.min(30, late * 10) + Math.min(12, partial * 4);
  factors.push({
    id: "loyers",
    ok: late === 0 && partial === 0,
    label:
      late === 0 && partial === 0
        ? "Tous les loyers sont encaissés"
        : `${late + partial} loyer${late + partial > 1 ? "s" : ""} en retard ou partiel${late + partial > 1 ? "s" : ""}`,
  });

  const occupancy = getOccupancyRate(data);
  score -= Math.min(20, Math.round((100 - occupancy) / 5));
  factors.push({
    id: "occupation",
    ok: occupancy >= 90,
    label: `Taux d'occupation : ${Math.round(occupancy)} %`,
  });

  const { cashflow } = getMonthFinancials(data, month);
  if (cashflow < 0) score -= 10;
  factors.push({
    id: "cashflow",
    ok: cashflow >= 0,
    label: cashflow >= 0 ? "Cash-flow du mois positif" : "Cash-flow du mois négatif",
  });

  const missingDocs = getMissingDocuments(data).length;
  score -= Math.min(12, missingDocs * 3);
  factors.push({
    id: "documents",
    ok: missingDocs === 0,
    label:
      missingDocs === 0
        ? "Dossiers administratifs complets"
        : `${missingDocs} document${missingDocs > 1 ? "s" : ""} à ajouter`,
  });

  const activeWorks = data.works.filter((w) => w.status === "en_cours").length;
  score -= Math.min(6, activeWorks * 2);
  factors.push({
    id: "travaux",
    ok: activeWorks === 0,
    label:
      activeWorks === 0
        ? "Aucun chantier actif"
        : `${activeWorks} chantier${activeWorks > 1 ? "s" : ""} en cours`,
  });

  score = Math.max(5, Math.min(100, score));
  const label =
    score >= 90 ? "Excellent" : score >= 75 ? "Bon" : score >= 55 ? "À surveiller" : "Fragile";
  return { score, label, factors };
}

/* ------------------------------------------------------------------ */
/* Logements prioritaires                                              */
/* ------------------------------------------------------------------ */

export interface PriorityProperty {
  property: Property;
  /** Motif principal d'attention. */
  alert: string;
  severity: number;
  /** Dernier paiement reçu (date), s'il existe. */
  lastPaidAt: string | null;
}

/** Logements demandant le plus d'attention (retard > vacance > partiel > travaux). */
export function getPriorityProperties(data: AppData, limit = 3): PriorityProperty[] {
  return data.properties
    .map((property) => {
      const payments = data.rentPayments.filter((p) => p.propertyId === property.id);
      const late = payments.filter((p) => p.status === "retard").length;
      const partial = payments.filter((p) => p.status === "partiel").length;
      const lastPaidAt = getLastPaymentDate(data, property.id);

      let severity = 0;
      let alert = "";
      if (late > 0) {
        severity = 4;
        alert = `${late} loyer${late > 1 ? "s" : ""} en retard`;
      } else if (property.status === "vacant") {
        severity = 3;
        alert = "Logement vacant";
      } else if (partial > 0) {
        severity = 2;
        alert = `${partial} paiement${partial > 1 ? "s" : ""} partiel${partial > 1 ? "s" : ""}`;
      } else if (property.status === "travaux") {
        severity = 1;
        alert = "En travaux";
      }
      return { property, alert, severity, lastPaidAt };
    })
    .filter((entry) => entry.severity > 0)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, limit);
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
