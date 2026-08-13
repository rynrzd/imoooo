"use client";

import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Camera,
  FileText,
  Hammer,
  MapPin,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PropertyStatusBadge, RentStatusBadge } from "@/components/shared/status-badge";
import type { PropertyFinancials } from "@/lib/finance";
import { formatCurrency, formatDate, formatPercent, formatSurface } from "@/lib/format";
import { RENT_STATUS_LABELS } from "@/lib/labels";
import type { Property, RentPayment, Tenant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PropertyActions } from "./property-actions";
import { PropertyThumb } from "./property-thumb";

/** Données pré-calculées d'un logement (partagées carte / vue liste). */
export interface PropertyEntry {
  property: Property;
  tenant: Tenant | null;
  financials: PropertyFinancials;
  /** Échéance du mois en cours, si un bail est actif. */
  monthPayment: RentPayment | null;
  /** Date du dernier encaissement. */
  lastPaidAt: string | null;
  counts: { documents: number; photos: number; works: number };
}

/** Petit résumé d'une ligne, dérivé de l'état du logement. */
export function propertySummary(entry: PropertyEntry): string {
  const { property, tenant, monthPayment } = entry;
  if (tenant) {
    const rentState = monthPayment
      ? `loyer du mois : ${RENT_STATUS_LABELS[monthPayment.status].toLowerCase()}`
      : "aucune échéance ce mois-ci";
    return `Loué à ${tenant.firstName} ${tenant.lastName} · ${rentState}`;
  }
  if (property.status === "travaux") return "En rénovation — chantier à suivre";
  return "Vacant — prêt à accueillir un locataire";
}

interface PropertyCardProps {
  entry: PropertyEntry;
}

/** Carte premium d'un logement : un dossier vivant du portefeuille. */
export function PropertyCard({ entry }: PropertyCardProps) {
  const { property, financials, monthPayment, lastPaidAt, counts } = entry;

  return (
    <Card className="card-lift h-full gap-0 overflow-hidden py-0">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Link
          href={`/logements/${property.id}`}
          aria-label={`Ouvrir le dossier — ${property.name}`}
          className="absolute inset-0"
        >
          {/* L'emplacement occupe la même place avec ou sans photo :
              c'est le conteneur qui porte les dimensions. */}
          <PropertyThumb
            src={property.photo}
            alt={`Photo — ${property.name}`}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="size-full"
            label="Aucune photo"
          />
          {/* Le dégradé n'a de sens que sous une vraie photo : sur le
              placeholder il assombrirait une surface déjà calme. */}
          {property.photo ? (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent"
            />
          ) : null}
        </Link>
        <div className="pointer-events-none absolute top-3 left-3">
          <PropertyStatusBadge status={property.status} />
        </div>
        <div className="absolute top-2 right-2">
          <PropertyActions property={property} variant="overlay" />
        </div>
        {/* Sur une photo, le texte est blanc sur dégradé ; sur le placeholder
            clair, il repasse à l'encre — sinon il deviendrait invisible. */}
        <p
          className={cn(
            "pointer-events-none absolute bottom-2.5 left-3 text-xs font-medium",
            property.photo ? "text-white/95" : "text-muted-foreground"
          )}
        >
          Rentabilité brute {formatPercent(financials.grossYield)}
        </p>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/logements/${property.id}`}
              className="truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {property.name}
            </Link>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(property.rent + property.charges)}
              <span className="text-xs font-normal text-muted-foreground"> /mois</span>
            </p>
          </div>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {property.address}, {property.postalCode} {property.city}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Ruler className="size-3" aria-hidden />
            {formatSurface(property.surface)}
          </span>
          <span className="flex items-center gap-1">
            <BedDouble className="size-3" aria-hidden />
            {property.rooms} {property.rooms > 1 ? "pièces" : "pièce"}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
            {property.type}
          </span>
        </div>

        <Separator />

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Loyer + charges</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatCurrency(property.rent)}
              <span className="text-muted-foreground"> + {formatCurrency(property.charges)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cash-flow cumulé</dt>
            <dd
              className={cn(
                "font-medium tabular-nums",
                financials.net >= 0
                  ? "text-success"
                  : "text-danger"
              )}
            >
              {formatCurrency(financials.net)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dernier paiement</dt>
            <dd className="font-medium text-foreground">
              {lastPaidAt ? formatDate(lastPaidAt) : "Aucun"}
            </dd>
          </div>
        </dl>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="size-3" aria-hidden />
              {counts.documents} doc{counts.documents > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Camera className="size-3" aria-hidden />
              {counts.photos} photo{counts.photos > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Hammer className="size-3" aria-hidden />
              {counts.works} travaux
            </span>
          </div>
          {monthPayment ? <RentStatusBadge status={monthPayment.status} /> : null}
        </div>

        <p className="truncate text-xs text-muted-foreground">{propertySummary(entry)}</p>

        <div className="mt-auto pt-1">
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
}
