"use client";

import {
  CalendarClock,
  FileWarning,
  Hammer,
  Home,
  Receipt,
  UserRound,
} from "lucide-react";
import { ListRow } from "@/components/shared/list-row";
import { getMissingDocuments } from "@/lib/insights";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { PROPERTY_STATUS_LABELS } from "@/lib/labels";
import { getPropertyPayments, tenantFullName } from "@/lib/finance";
import { useAppStore } from "@/lib/store";
import type { Property } from "@/lib/types";

/**
 * Aperçu d'un logement — cinq lignes, pas une de plus.
 *
 * Statut, locataire, prochain loyer, document manquant, chantier ou dépense en
 * cours : les seules choses qu'on vient vérifier en ouvrant un bien. Chaque
 * ligne ouvre l'écran où l'on agit vraiment (onglet Location, Loyers,
 * Documents, Finances) — aucune information sans issue.
 *
 * Les indicateurs détaillés (rendement, occupation sur douze mois, cumuls)
 * restent affichés au-dessus de 1024 px, où il y a la place de les lire.
 */
export function PropertySummary({ property }: { property: Property }) {
  const { data } = useAppStore();

  const tenant = data.tenants.find(
    (t) => t.propertyId === property.id && !t.exitDate
  );

  const nextPayment = getPropertyPayments(data, property.id)
    .filter((p) => p.received < p.expected)
    .sort((a, b) => a.month.localeCompare(b.month))[0];

  const missing = getMissingDocuments(data).filter(
    (m) => m.property.id === property.id
  );

  const work = data.works.find(
    (w) => w.propertyId === property.id && w.status === "en_cours"
  );
  const lastExpense = [...data.expenses]
    .filter((e) => e.propertyId === property.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ListRow
        icon={Home}
        title="Statut"
        value={PROPERTY_STATUS_LABELS[property.status]}
        href={`/logements/${property.id}?tab=location`}
        tone={property.status === "loue" ? "positive" : "warning"}
      />

      <ListRow
        icon={UserRound}
        title="Locataire"
        subtitle={tenant ? `depuis le ${formatDate(tenant.entryDate)}` : undefined}
        value={tenant ? tenantFullName(tenant) : "Aucun"}
        href={`/logements/${property.id}?tab=location`}
      />

      <ListRow
        icon={CalendarClock}
        title="Prochain loyer"
        subtitle={nextPayment ? formatMonth(nextPayment.month) : undefined}
        value={
          nextPayment
            ? formatCurrency(nextPayment.expected - nextPayment.received)
            : "—"
        }
        hint={nextPayment?.status === "retard" ? "en retard" : undefined}
        tone={nextPayment?.status === "retard" ? "danger" : "default"}
        href={`/logements/${property.id}?tab=location`}
      />

      <ListRow
        icon={FileWarning}
        title="Documents"
        value={missing.length > 0 ? "À compléter" : "Complets"}
        hint={missing.length > 0 ? missing.map((m) => m.label).join(" · ") : undefined}
        tone={missing.length > 0 ? "warning" : "default"}
        href={`/logements/${property.id}?tab=documents`}
      />

      <ListRow
        icon={work ? Hammer : Receipt}
        title={work ? "Chantier en cours" : "Dernière dépense"}
        subtitle={work ? work.title : lastExpense ? lastExpense.label : undefined}
        value={
          work
            ? formatCurrency(work.amount)
            : lastExpense
              ? formatCurrency(lastExpense.amount)
              : "Aucune"
        }
        hint={work ? "en cours" : undefined}
        tone={work ? "warning" : "default"}
        href={`/logements/${property.id}?tab=finances`}
      />
    </div>
  );
}
