"use client";

import * as React from "react";
import {
  ArrowDownToLine,
  Camera,
  FileText,
  Hammer,
  Pencil,
  Percent,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionCenter } from "@/components/dashboard/action-center";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { AddWorkDialog } from "@/components/works/add-work-dialog";
import { RecordPaymentDialog } from "@/components/rents/record-payment-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { lastMonths } from "@/lib/dates";
import {
  getPropertyFinancials,
  getPropertyPayments,
} from "@/lib/finance";
import { getActionItems } from "@/lib/insights";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSurface,
} from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Property } from "@/lib/types";
import { EditPropertySheet } from "./edit-property-sheet";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Raccourcis du dossier : chaque bouton ouvre une vraie action. */
function PropertyShortcuts({ property }: { property: Property }) {
  const { data } = useAppStore();
  const [dialog, setDialog] = React.useState<
    "document" | "photo" | "work" | "edit" | null
  >(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const nextDue = getPropertyPayments(data, property.id)
    .filter((p) => p.received < p.expected)
    .sort((a, b) => a.month.localeCompare(b.month))[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Raccourcis</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {nextDue ? (
          <RecordPaymentDialog payment={nextDue} triggerLabel="Enregistrer un paiement" />
        ) : null}
        <Button variant="outline" size="sm" onClick={() => setDialog("document")}>
          <FileText data-icon="inline-start" />
          Ajouter un document
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("photo")}>
          <Camera data-icon="inline-start" />
          Ajouter des photos
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("work")}>
          <Hammer data-icon="inline-start" />
          Ajouter des travaux
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("edit")}>
          <Pencil data-icon="inline-start" />
          Modifier le bien
        </Button>
      </CardContent>

      {dialog === "document" ? (
        <AddDocumentDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "photo" ? (
        <AddPhotoDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "work" ? (
        <AddWorkDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "edit" ? (
        <EditPropertySheet property={property} showTrigger={false} open onOpenChange={close} />
      ) : null}
    </Card>
  );
}

interface PropertyOverviewProps {
  property: Property;
}

/** Onglet « Vue d'ensemble » : tableau de bord complet du logement. */
export function PropertyOverview({ property }: PropertyOverviewProps) {
  const { data } = useAppStore();
  const financials = getPropertyFinancials(data, property);
  const payments = getPropertyPayments(data, property.id);
  const history = data.activity.filter((a) => a.propertyId === property.id);
  const actions = getActionItems(data).filter((a) => a.propertyId === property.id);

  const window = new Set(lastMonths(12));
  const expenses12 = data.expenses
    .filter((e) => e.propertyId === property.id && window.has(e.date.slice(0, 7)))
    .reduce((acc, e) => acc + e.amount, 0);
  const netYield =
    property.purchasePrice > 0
      ? ((property.rent * 12 - expenses12) * 100) / property.purchasePrice
      : 0;
  const occupiedMonths = new Set(
    payments.filter((p) => window.has(p.month)).map((p) => p.month)
  ).size;
  const remaining = payments.reduce(
    (acc, p) => acc + Math.max(0, p.expected - p.received),
    0
  );
  const activeWorks = data.works.filter(
    (w) => w.propertyId === property.id && w.status === "en_cours"
  ).length;

  return (
    <div className="space-y-4">
      {/* KPIs du logement */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Loyers encaissés"
          value={formatCurrency(financials.totalRevenue)}
          icon={ArrowDownToLine}
          tone="positive"
        />
        <StatCard
          label="Dépenses cumulées"
          value={formatCurrency(financials.totalExpenses)}
          icon={Receipt}
          tone="negative"
        />
        <StatCard
          label="Résultat net"
          value={formatCurrency(financials.net)}
          icon={PiggyBank}
          tone={financials.net >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Rendement brut / net"
          value={formatPercent(financials.grossYield)}
          hint={`net estimé : ${formatPercent(netYield)} (12 mois)`}
          icon={Percent}
        />
        <StatCard
          label="Occupation (12 mois)"
          value={formatPercent((occupiedMonths * 100) / 12, 0)}
          progress={(occupiedMonths * 100) / 12}
          icon={Wallet}
        />
        <StatCard
          label="Restant à encaisser"
          value={formatCurrency(remaining)}
          icon={Wallet}
          tone={remaining > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Travaux en cours"
          value={String(activeWorks)}
          icon={Hammer}
          tone={activeWorks > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Loyer mensuel"
          value={formatCurrency(property.rent + property.charges)}
          hint="charges comprises"
          icon={Wallet}
        />
      </div>

      {/* À traiter pour ce logement */}
      <ActionCenter items={actions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Caractéristiques</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <InfoRow
                label="Adresse"
                value={`${property.address}, ${property.postalCode} ${property.city}`}
              />
              <InfoRow label="Type" value={property.type} />
              <InfoRow label="Surface" value={formatSurface(property.surface)} />
              <InfoRow
                label="Pièces"
                value={`${property.rooms} pièce${property.rooms > 1 ? "s" : ""}`}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Finances</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <InfoRow label="Prix d'achat" value={formatCurrency(property.purchasePrice)} />
              <InfoRow label="Date d'achat" value={formatDate(property.purchaseDate)} />
              <InfoRow
                label="Loyer mensuel"
                value={`${formatCurrency(property.rent)} + ${formatCurrency(property.charges)} de charges`}
              />
              <InfoRow
                label="Dépenses sur 12 mois"
                value={formatCurrency(expenses12)}
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity items={history} limit={6} />
        <PropertyShortcuts property={property} />
      </div>
    </div>
  );
}
