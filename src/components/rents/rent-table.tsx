"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RentStatusBadge } from "@/components/shared/status-badge";
import { getProperty, getTenant, tenantFullName } from "@/lib/finance";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { RentPayment } from "@/lib/types";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";

interface RentTableProps {
  payments: RentPayment[];
  /** Affiche les colonnes Logement / Locataire (vue globale). */
  showProperty?: boolean;
}

/** Tableau des loyers, réutilisé par la page Loyers et la fiche logement. */
export function RentTable({ payments, showProperty = false }: RentTableProps) {
  const { data } = useAppStore();
  const sorted = [...payments].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mois</TableHead>
            {showProperty ? <TableHead>Logement</TableHead> : null}
            {showProperty ? <TableHead className="max-lg:hidden">Locataire</TableHead> : null}
            <TableHead className="text-right">Prévu</TableHead>
            <TableHead className="text-right">Reçu</TableHead>
            <TableHead className="max-sm:hidden">Date</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="max-xl:hidden">Commentaire</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((payment) => {
            const property = getProperty(data, payment.propertyId);
            const tenant = getTenant(data, payment.tenantId);
            const settled = payment.received >= payment.expected;
            return (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{formatMonth(payment.month)}</TableCell>
                {showProperty ? (
                  <TableCell className="text-muted-foreground">{property?.name}</TableCell>
                ) : null}
                {showProperty ? (
                  <TableCell className="text-muted-foreground max-lg:hidden">
                    {tenant ? tenantFullName(tenant) : "—"}
                  </TableCell>
                ) : null}
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(payment.expected)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(payment.received)}
                </TableCell>
                <TableCell className="text-muted-foreground max-sm:hidden">
                  {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                </TableCell>
                <TableCell>
                  <RentStatusBadge status={payment.status} />
                </TableCell>
                <TableCell className="max-w-52 truncate text-muted-foreground max-xl:hidden">
                  {payment.comment || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    {!settled ? <RecordPaymentDialog payment={payment} /> : null}
                    <EditPaymentDialog payment={payment} />
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
