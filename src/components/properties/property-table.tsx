"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PropertyStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PropertyActions } from "./property-actions";
import { PropertyThumb } from "./property-thumb";
import type { PropertyEntry } from "./property-card";

interface PropertyTableProps {
  entries: PropertyEntry[];
}

/** Vue liste du portefeuille : une ligne compacte par logement. */
export function PropertyTable({ entries }: PropertyTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Logement</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Loyer CC</TableHead>
            <TableHead className="text-right max-md:hidden">Rentabilité</TableHead>
            <TableHead className="text-right max-lg:hidden">Cash-flow</TableHead>
            <TableHead className="max-lg:hidden">Dernier paiement</TableHead>
            <TableHead className="max-xl:hidden">Dossier</TableHead>
            <TableHead className="w-12 pr-3" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const { property, financials, lastPaidAt, counts } = entry;
            return (
              <TableRow key={property.id}>
                <TableCell className="pl-4">
                  <Link
                    href={`/logements/${property.id}`}
                    className="flex items-center gap-3"
                  >
                    <PropertyThumb
                      src={property.photo}
                      alt=""
                      sizes="40px"
                      className="size-10 rounded-lg"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {property.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {property.city} · {property.type}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <PropertyStatusBadge status={property.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(property.rent + property.charges)}
                </TableCell>
                <TableCell className="text-right tabular-nums max-md:hidden">
                  {formatPercent(financials.grossYield)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums max-lg:hidden",
                    financials.net >= 0
                      ? "text-success"
                      : "text-danger"
                  )}
                >
                  {formatCurrency(financials.net)}
                </TableCell>
                <TableCell className="text-muted-foreground max-lg:hidden">
                  {lastPaidAt ? formatDate(lastPaidAt) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-xl:hidden">
                  {counts.documents} docs · {counts.photos} photos · {counts.works} travaux
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <PropertyActions property={property} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
