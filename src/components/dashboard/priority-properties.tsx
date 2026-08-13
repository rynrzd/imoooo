"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PropertyStatusBadge } from "@/components/shared/status-badge";
import { PropertyThumb } from "@/components/properties/property-thumb";
import { getPropertyFinancials } from "@/lib/finance";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type { PriorityProperty } from "@/lib/insights";
import { useAppStore } from "@/lib/store";

interface PriorityPropertiesProps {
  entries: PriorityProperty[];
}

/** Logements demandant le plus d'attention, avec accès direct au dossier. */
export function PriorityProperties({ entries }: PriorityPropertiesProps) {
  const { data } = useAppStore();
  if (entries.length === 0) return null;

  return (
    <section aria-label="Logements prioritaires" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Logements à surveiller
        </h2>
        <p className="text-xs text-muted-foreground">
          Les biens qui demandent votre attention en priorité.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ property, alert, lastPaidAt }) => {
          const financials = getPropertyFinancials(data, property);
          return (
            <Card key={property.id} className="card-lift gap-0 overflow-hidden py-0">
              <div className="relative h-32 overflow-hidden bg-muted">
                <PropertyThumb
                  src={property.photo}
                  alt={`Photo — ${property.name}`}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="size-full"
                />
                <div className="absolute top-2.5 left-2.5">
                  <PropertyStatusBadge status={property.status} />
                </div>
              </div>
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {property.name}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    {property.address}, {property.city}
                  </p>
                </div>

                <p className="flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-warning">
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                  {alert}
                </p>

                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Loyer</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatCurrency(property.rent + property.charges)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Rentabilité</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatPercent(financials.grossYield)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Dernier paiement</dt>
                    <dd className="font-medium text-foreground">
                      {lastPaidAt ? formatDate(lastPaidAt) : "Aucun"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    nativeButton={false} render={<Link href={`/logements/${property.id}`} />}
                  >
                    Ouvrir le dossier
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
