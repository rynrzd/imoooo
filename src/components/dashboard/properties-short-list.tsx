"use client";

import Link from "next/link";
import { ListRow, type ListRowTone } from "@/components/shared/list-row";
import { formatCurrency } from "@/lib/format";
import { PROPERTY_STATUS_LABELS } from "@/lib/labels";
import type { AppData, Property } from "@/lib/types";

/**
 * Liste courte des logements — nom, statut, loyer, et c'est tout.
 *
 * Le tableau complet et ses filtres vivent sur l'écran Logements ; ici on ne
 * garde que de quoi reconnaître un bien et l'ouvrir. Le statut est écrit en
 * toutes lettres, la couleur ne fait que le confirmer.
 */

const TONES: Record<Property["status"], ListRowTone> = {
  loue: "positive",
  vacant: "warning",
  travaux: "default",
};

export function PropertiesShortList({
  data,
  limit = 4,
}: {
  data: AppData;
  limit?: number;
}) {
  const properties = data.properties.slice(0, limit);
  const rest = data.properties.length - properties.length;

  return (
    <section aria-labelledby="mes-logements" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mes-logements" className="text-sm font-medium text-foreground">
          Logements
        </h2>
        <Link
          href="/logements"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          {rest > 0 ? `Voir les ${data.properties.length}` : "Tout voir"}
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {properties.map((property) => {
          const tenant = data.tenants.find(
            (t) => t.propertyId === property.id && !t.exitDate
          );
          return (
            <ListRow
              key={property.id}
              href={`/logements/${property.id}`}
              title={property.name}
              subtitle={
                tenant
                  ? `${tenant.firstName} ${tenant.lastName}`.trim()
                  : `${property.type} · ${property.city}`
              }
              value={property.rent > 0 ? formatCurrency(property.rent) : undefined}
              hint={PROPERTY_STATUS_LABELS[property.status]}
              tone={TONES[property.status]}
            />
          );
        })}
      </div>
    </section>
  );
}
