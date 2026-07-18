"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarClock, MapPin, Percent, PiggyBank, UserRound, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PropertyStatusBadge } from "@/components/shared/status-badge";
import { RecordPaymentDialog } from "@/components/rents/record-payment-dialog";
import { needsUnoptimized } from "@/lib/constants";
import {
  getPropertyFinancials,
  getPropertyPayments,
  getTenant,
  tenantFullName,
} from "@/lib/finance";
import { formatCurrency, formatMonth, formatPercent, formatSurface } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Property } from "@/lib/types";
import { EditPropertySheet } from "./edit-property-sheet";
import { PropertyActions } from "./property-actions";

interface PropertyHeaderProps {
  property: Property;
}

/** Header immersif du dossier : photo, identité du bien, KPIs, actions. */
export function PropertyHeader({ property }: PropertyHeaderProps) {
  const { data } = useAppStore();
  const tenant = getTenant(data, property.currentTenantId);
  const financials = getPropertyFinancials(data, property);
  const payments = getPropertyPayments(data, property.id);

  // Prochaine échéance : la plus ancienne échéance non soldée.
  const nextDue = payments
    .filter((p) => p.received < p.expected)
    .sort((a, b) => a.month.localeCompare(b.month))[0];

  return (
    <div className="space-y-4">
      {/* Photo et identité */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <div className="relative aspect-[3/1] min-h-52">
          <Image
            src={property.photo}
            alt={`Photo — ${property.name}`}
            fill
            priority
            sizes="(max-width: 1152px) 100vw, 1152px"
            unoptimized={needsUnoptimized(property.photo)}
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <PropertyStatusBadge status={property.status} />
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {property.name}
              </h1>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-white/85">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {property.address}, {property.postalCode} {property.city}
                <span aria-hidden> · </span>
                {property.type} · {formatSurface(property.surface)}
              </p>
              {tenant ? (
                <Link
                  href={`/locataires/${tenant.id}`}
                  className="flex w-fit items-center gap-1.5 text-sm text-white/85 underline-offset-2 hover:underline"
                >
                  <UserRound className="size-3.5" aria-hidden />
                  {tenantFullName(tenant)}
                </Link>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {nextDue ? (
                <RecordPaymentDialog
                  payment={nextDue}
                  triggerLabel="Enregistrer un loyer"
                  triggerVariant="default"
                />
              ) : null}
              <EditPropertySheet property={property} />
              <PropertyActions property={property} variant="overlay" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs immédiats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Loyer mensuel"
          value={formatCurrency(property.rent + property.charges)}
          hint={`dont ${formatCurrency(property.charges)} de charges`}
          icon={Wallet}
        />
        <StatCard
          label="Rendement brut"
          value={formatPercent(financials.grossYield)}
          hint={`achat : ${formatCurrency(property.purchasePrice)}`}
          icon={Percent}
        />
        <StatCard
          label="Revenu net cumulé"
          value={formatCurrency(financials.net)}
          hint="revenus − dépenses"
          icon={PiggyBank}
          tone={financials.net >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Prochaine échéance"
          value={
            nextDue ? formatCurrency(nextDue.expected - nextDue.received) : "À jour"
          }
          hint={
            nextDue
              ? `loyer de ${formatMonth(nextDue.month).toLowerCase()}`
              : "aucune échéance en attente"
          }
          icon={CalendarClock}
          tone={nextDue ? "warning" : "positive"}
        />
      </div>
    </div>
  );
}
