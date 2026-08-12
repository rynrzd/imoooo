"use client";

import { RentStatusBadge } from "@/components/shared/status-badge";
import { getProperty, getTenant, tenantFullName } from "@/lib/finance";
import { formatCurrency, formatMonth } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { RentPayment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";

/**
 * Loyers, version TÉLÉPHONE — une ligne par échéance.
 *
 * Le tableau desktop compte neuf colonnes ; le mettre dans un conteneur qui
 * défile horizontalement obligeait à balayer l'écran pour lire un montant.
 * Ici : le mois et le logement à gauche, le montant à droite, le statut en
 * toutes lettres, et l'encaissement à portée de pouce. Aucune donnée
 * supprimée — le commentaire et la date d'encaissement restent dans la
 * fiche d'édition, et le tableau complet reste servi au-dessus de 1024 px.
 */
export function RentList({
  payments,
  showProperty = false,
}: {
  payments: RentPayment[];
  showProperty?: boolean;
}) {
  const { data } = useAppStore();
  const sorted = [...payments].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {sorted.map((payment) => {
        const property = getProperty(data, payment.propertyId);
        const tenant = getTenant(data, payment.tenantId);
        const settled = payment.received >= payment.expected;
        const remaining = payment.expected - payment.received;

        return (
          <div
            key={payment.id}
            className="flex min-h-16 items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {formatMonth(payment.month)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {showProperty && property ? property.name : null}
                {showProperty && property && tenant ? " · " : null}
                {tenant ? tenantFullName(tenant) : null}
                {!showProperty && !tenant ? "—" : null}
              </p>
              <div className="mt-1">
                <RentStatusBadge status={payment.status} />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  settled ? "text-foreground" : "text-foreground"
                )}
              >
                {formatCurrency(payment.received)}
                <span className="text-muted-foreground"> / {formatCurrency(payment.expected)}</span>
              </p>
              {!settled ? (
                <p className="text-xs text-muted-foreground">
                  reste {formatCurrency(remaining)}
                </p>
              ) : null}
              {/* Cibles de 44 px : les déclencheurs `sm` du design system
                  font 28 px, insuffisant au pouce. */}
              <div className="mt-1 flex items-center justify-end gap-1 [&_button]:h-11 [&_button]:min-w-11 [&_button]:px-3">
                {!settled ? <RecordPaymentDialog payment={payment} /> : null}
                <EditPaymentDialog payment={payment} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
