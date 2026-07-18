"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  History,
  Mail,
  NotebookPen,
  Phone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { DeleteTenantDialog } from "@/components/tenants/delete-tenant-dialog";
import { EditTenantDialog } from "@/components/tenants/edit-tenant-dialog";
import { EndLeaseDialog } from "@/components/tenants/end-lease-dialog";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RentTable } from "@/components/rents/rent-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { monthsBetween } from "@/lib/dates";
import { useGuarantor, useTenantNotes } from "@/lib/tenant-dossier";
import { getProperty } from "@/lib/finance";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { useAppStore } from "@/lib/store";

export default function TenantDetailPage({
  params,
}: PageProps<"/locataires/[id]">) {
  const { id } = React.use(params);
  const { data } = useAppStore();

  const tenant = data.tenants.find((t) => t.id === id);
  // Hooks appelés avant toute sortie anticipée (règles des hooks).
  const { notes, setNotes, saveNotes } = useTenantNotes(tenant?.id ?? "");
  const guarantor = useGuarantor(tenant?.email ?? "");
  if (!tenant) notFound();

  const property = getProperty(data, tenant.propertyId);
  const active = tenant.exitDate === null;
  const payments = data.rentPayments.filter((p) => p.tenantId === tenant.id);
  const totalReceived = payments.reduce((acc, p) => acc + p.received, 0);
  const lateCount = payments.filter((p) => p.status === "retard").length;
  const documents = data.documents.filter((d) => d.propertyId === tenant.propertyId);
  const history = data.activity.filter((a) => a.propertyId === tenant.propertyId);
  const tenure = monthsBetween(tenant.entryDate, tenant.exitDate);

  return (
    <>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" render={<Link href="/locataires" />}>
          <ArrowLeft data-icon="inline-start" />
          Retour aux locataires
        </Button>

        {/* En-tête du dossier */}
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
                  {initials(tenant.firstName, tenant.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    {tenant.firstName} {tenant.lastName}
                  </h1>
                  <Badge
                    variant="outline"
                    className={
                      active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "border-border bg-muted text-muted-foreground"
                    }
                  >
                    {active ? "Bail en cours" : "Parti"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {property ? (
                    <Link
                      href={`/logements/${property.id}`}
                      className="flex items-center gap-1.5 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      <Building2 className="size-3.5" />
                      {property.name}
                    </Link>
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Entrée le {formatDate(tenant.entryDate)}
                    {tenant.exitDate ? ` — sortie le ${formatDate(tenant.exitDate)}` : ""}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                Écrire
              </Button>
              <EditTenantDialog tenant={tenant} />
              {active ? <EndLeaseDialog tenant={tenant} /> : null}
              <DeleteTenantDialog tenant={tenant} />
            </div>
          </CardContent>
        </Card>

        {/* Statistiques du bail */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Loyer mensuel"
            value={formatCurrency(tenant.rent + tenant.charges)}
            hint={`dont ${formatCurrency(tenant.charges)} de charges`}
            icon={Wallet}
          />
          <StatCard
            label="Encaissé au total"
            value={formatCurrency(totalReceived)}
            hint={`depuis le ${formatDate(tenant.entryDate)}`}
            icon={ArrowDownToLine}
            tone="positive"
          />
          <StatCard
            label="Loyers en retard"
            value={String(lateCount)}
            icon={AlertTriangle}
            tone={lateCount > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Ancienneté"
            value={`${tenure} mois`}
            hint={`dépôt de garantie : ${formatCurrency(tenant.deposit)}`}
            icon={ShieldCheck}
          />
        </div>
      </div>

      <Tabs defaultValue="payments">
        <div className="overflow-x-auto">
          <TabsList
            variant="line"
            className="w-max min-w-full justify-start border-b border-border"
          >
            <TabsTrigger value="payments">
              <Wallet data-icon="inline-start" />
              Paiements
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText data-icon="inline-start" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <History data-icon="inline-start" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="notes">
              <NotebookPen data-icon="inline-start" />
              Notes
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payments" className="animate-panel-in space-y-4 pt-4">
          {payments.length > 0 ? (
            <RentTable payments={payments} />
          ) : (
            <EmptyState
              icon={Wallet}
              title="Aucun paiement enregistré"
              description="Les échéances de ce locataire apparaîtront ici."
            />
          )}
        </TabsContent>

        <TabsContent value="documents" className="animate-panel-in space-y-4 pt-4">
          <div className="flex justify-end">
            <AddDocumentDialog propertyId={tenant.propertyId} />
          </div>
          {documents.length > 0 ? (
            <DocumentList documents={documents} />
          ) : (
            <EmptyState
              icon={FileText}
              title="Aucun document"
              description="Ajoutez le bail, l'état des lieux ou l'attestation d'assurance du locataire."
            />
          )}
        </TabsContent>

        <TabsContent value="timeline" className="animate-panel-in pt-4">
          {history.length > 0 ? (
            <RecentActivity items={history} limit={20} />
          ) : (
            <EmptyState
              icon={History}
              title="Aucun événement"
              description="Les événements liés au logement de ce locataire s'afficheront ici."
            />
          )}
        </TabsContent>

        <TabsContent value="notes" className="animate-panel-in space-y-4 pt-4">
          {guarantor ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Garant</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{guarantor.name}</span>
                {guarantor.phone ? (
                  <a
                    href={`tel:${guarantor.phone.replaceAll(" ", "")}`}
                    className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                  >
                    <Phone className="size-3.5" />
                    {guarantor.phone}
                  </a>
                ) : null}
                {guarantor.email ? (
                  <a
                    href={`mailto:${guarantor.email}`}
                    className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                  >
                    <Mail className="size-3.5" />
                    {guarantor.email}
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Notes privées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Préférences de contact, incidents, accords particuliers…"
                className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Notes sur le locataire"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    saveNotes();
                    toast.success("Notes enregistrées.");
                  }}
                >
                  Enregistrer les notes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
