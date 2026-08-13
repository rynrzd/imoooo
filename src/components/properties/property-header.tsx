"use client";

import Link from "next/link";
import { CalendarClock, MapPin, Percent, PiggyBank, UserRound, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PropertyStatusBadge } from "@/components/shared/status-badge";
import { RecordPaymentDialog } from "@/components/rents/record-payment-dialog";
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
import { PropertyThumb } from "./property-thumb";

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
      {/* ---------------- TÉLÉPHONE : photo courte, texte en dessous ----------
          Le titre, l'adresse et trois boutons posés SUR la photo devenaient
          illisibles sous 400 px (le dégradé ne couvrait plus rien). Ici la
          photographie n'est qu'un bandeau, et l'identité se lit sur le fond
          de la carte. Aucune information n'a été retirée. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card lg:hidden">
        {/* Le bandeau existe TOUJOURS, avec ou sans photo : sa hauteur ne
            change pas, donc rien ne saute au chargement. */}
        <PropertyThumb
          src={property.photo}
          alt={`Photo — ${property.name}`}
          sizes="100vw"
          priority
          className="block h-28 w-full"
          label="Aucune photo pour ce logement"
        />
        <div className="space-y-2 p-4">
          <PropertyStatusBadge status={property.status} />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {property.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {property.address}, {property.postalCode} {property.city}
          </p>
          <p className="text-sm text-muted-foreground">
            {property.type} · {formatSurface(property.surface)}
          </p>
          {tenant ? (
            <Link
              href={`/locataires/${tenant.id}`}
              className="flex min-h-11 w-fit items-center gap-1.5 text-sm text-foreground underline-offset-2 hover:underline"
            >
              <UserRound className="size-3.5" aria-hidden />
              {tenantFullName(tenant)}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1 [&_button]:h-11">
            {nextDue ? (
              <RecordPaymentDialog
                payment={nextDue}
                triggerLabel="Enregistrer un loyer"
                triggerVariant="default"
              />
            ) : null}
            <EditPropertySheet property={property} />
            <PropertyActions property={property} />
          </div>
        </div>
      </div>

      {/* ---------------- BUREAU ----------------
          UNE seule mise en page, avec ou sans photo. Sans photo, l'emplacement
          reçoit le placeholder BLEU NUIT : le titre blanc et le dégradé
          restent lisibles, la bannière garde exactement sa hauteur, et aucune
          image d'emprunt n'apparaît. */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted max-lg:hidden">
        <div className="relative aspect-[3/1] min-h-52">
          <PropertyThumb
            src={property.photo}
            alt=""
            sizes="(max-width: 1152px) 100vw, 1152px"
            priority
            tone="deep"
            className="size-full"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <PropertyStatusBadge status={property.status} />
              <p className="text-2xl font-semibold tracking-tight text-white">
                {property.name}
              </p>
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

      {/* KPIs immédiats — au bureau : sur téléphone, l'onglet Aperçu porte
          déjà l'essentiel en cinq lignes. */}
      <div className="grid grid-cols-1 gap-4 max-lg:hidden sm:grid-cols-2 xl:grid-cols-4">
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
