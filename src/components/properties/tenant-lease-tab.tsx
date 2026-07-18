"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { RecordPaymentDialog } from "@/components/rents/record-payment-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { EditTenantDialog } from "@/components/tenants/edit-tenant-dialog";
import { EndLeaseDialog } from "@/components/tenants/end-lease-dialog";
import { TenantCard } from "@/components/tenants/tenant-card";
import { monthsBetween } from "@/lib/dates";
import { getPropertyPayments, tenantFullName } from "@/lib/finance";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { useGuarantor } from "@/lib/tenant-dossier";
import { useAppStore } from "@/lib/store";
import type { Property, Tenant } from "@/lib/types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function CurrentTenant({ property, tenant }: { property: Property; tenant: Tenant }) {
  const { data } = useAppStore();
  const guarantor = useGuarantor(tenant.email);
  const [documentOpen, setDocumentOpen] = React.useState(false);

  const payments = getPropertyPayments(data, property.id).filter(
    (p) => p.tenantId === tenant.id
  );
  const problems = payments.filter(
    (p) => p.status === "retard" || p.status === "partiel"
  ).length;
  const nextDue = payments
    .filter((p) => p.received < p.expected)
    .sort((a, b) => a.month.localeCompare(b.month))[0];
  const tenure = monthsBetween(tenant.entryDate, tenant.exitDate);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-12">
              <AvatarFallback className="bg-primary/10 text-base font-medium text-primary">
                {initials(tenant.firstName, tenant.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">
                  {tenantFullName(tenant)}
                </p>
                <Badge
                  variant="outline"
                  className={
                    problems === 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                  }
                >
                  {problems === 0
                    ? "Paiements à jour"
                    : `${problems} paiement${problems > 1 ? "s" : ""} à suivre`}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Entré le {formatDate(tenant.entryDate)} · {tenure} mois d&apos;occupation
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {nextDue ? (
              <RecordPaymentDialog payment={nextDue} triggerLabel="Enregistrer un paiement" />
            ) : null}
            <EditTenantDialog tenant={tenant} />
            <EndLeaseDialog tenant={tenant} />
            <Button
              variant="outline"
              size="sm"
              render={<a href={`tel:${tenant.phone.replaceAll(" ", "")}`} />}
            >
              <Phone data-icon="inline-start" />
              Appeler
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href={`mailto:${tenant.email}`} />}
            >
              <Mail data-icon="inline-start" />
              Envoyer un e-mail
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDocumentOpen(true)}>
              <FileText data-icon="inline-start" />
              Ajouter un document
            </Button>
            <Button
              size="sm"
              render={<Link href={`/locataires/${tenant.id}`} />}
            >
              Dossier complet
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Bail en cours</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <InfoRow label="Début du bail" value={formatDate(tenant.entryDate)} />
              <InfoRow label="Loyer hors charges" value={formatCurrency(tenant.rent)} />
              <InfoRow label="Charges" value={formatCurrency(tenant.charges)} />
              <InfoRow
                label="Loyer charges comprises"
                value={formatCurrency(tenant.rent + tenant.charges)}
              />
              <InfoRow
                label="Dépôt de garantie"
                value={formatCurrency(tenant.deposit)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
              Garant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {guarantor ? (
              <dl className="divide-y divide-border">
                <InfoRow label="Nom" value={guarantor.name} />
                {guarantor.phone ? (
                  <InfoRow label="Téléphone" value={guarantor.phone} />
                ) : null}
                {guarantor.email ? (
                  <InfoRow label="E-mail" value={guarantor.email} />
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun garant renseigné pour ce bail. Vous pouvez l&apos;ajouter dans
                les notes du dossier locataire.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {documentOpen ? (
        <AddDocumentDialog
          propertyId={property.id}
          showTrigger={false}
          open
          onOpenChange={(next) => {
            if (!next) setDocumentOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

interface TenantLeaseTabProps {
  property: Property;
}

/** Onglet « Locataire et bail » : occupant actuel, bail, garant, historique. */
export function TenantLeaseTab({ property }: TenantLeaseTabProps) {
  const { data } = useAppStore();
  const current = data.tenants.find((t) => t.id === property.currentTenantId) ?? null;
  const former = data.tenants.filter(
    (t) => t.propertyId === property.id && t.id !== property.currentTenantId
  );

  return (
    <div className="space-y-6">
      {current ? (
        <CurrentTenant property={property} tenant={current} />
      ) : (
        <EmptyState
          icon={UserRound}
          title="Aucun locataire en place"
          description={
            property.status === "travaux"
              ? "Le logement est en travaux. Vous pourrez ajouter un locataire une fois le chantier terminé."
              : "Ajoutez un locataire pour démarrer le suivi des loyers."
          }
        >
          <AddTenantDialog propertyId={property.id} />
        </EmptyState>
      )}

      {former.length > 0 ? (
        <section className="space-y-3" aria-label="Anciens locataires">
          <h2 className="text-sm font-medium text-muted-foreground">
            Anciens locataires
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {former.map((t) => (
              <TenantCard key={t.id} tenant={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
