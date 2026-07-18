"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Hammer,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { RecordPaymentDialog } from "@/components/rents/record-payment-dialog";
import type { ActionItem, ActionKind, ActionSeverity } from "@/lib/insights";
import { cn } from "@/lib/utils";

const SEVERITY_BADGES: Record<ActionSeverity, { label: string; className: string }> = {
  critique: { label: "Critique", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
  important: { label: "Important", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  info: { label: "Info", className: "bg-muted text-muted-foreground" },
};

const KIND_ICONS: Record<ActionKind, { icon: LucideIcon; className: string }> = {
  loyer_retard: {
    icon: AlertTriangle,
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  loyer_partiel: {
    icon: Wallet,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  bail_bientot_termine: {
    icon: CalendarClock,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  logement_vacant: {
    icon: Building2,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  document_manquant: {
    icon: FileText,
    className: "bg-muted text-muted-foreground",
  },
  document_expire: {
    icon: FileText,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  chantier_en_cours: {
    icon: Hammer,
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
};

interface ActionCenterProps {
  items: ActionItem[];
}

/** Centre d'actions « À traiter aujourd'hui » : chaque ligne a une vraie action. */
export function ActionCenter({ items }: ActionCenterProps) {
  // Dialogues contrôlés ouverts depuis les lignes (locataire, document).
  const [tenantFor, setTenantFor] = React.useState<string | null>(null);
  const [documentFor, setDocumentFor] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">À traiter aujourd&apos;hui</CardTitle>
        {items.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {items.length} action{items.length > 1 ? "s" : ""} demande
            {items.length > 1 ? "nt" : ""} votre attention.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="px-3">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 px-4 py-5 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Rien à traiter aujourd&apos;hui. Votre patrimoine est à jour.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const config = KIND_ICONS[item.kind];
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 px-2 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span
                    className={cn(
                      "hidden size-7 shrink-0 items-center justify-center rounded-md sm:flex",
                      config.className
                    )}
                    aria-hidden
                  >
                    <config.icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{item.title}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          SEVERITY_BADGES[item.severity].className
                        )}
                      >
                        {SEVERITY_BADGES[item.severity].label}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {item.payment ? (
                      <RecordPaymentDialog payment={item.payment} />
                    ) : item.kind === "logement_vacant" && item.propertyId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTenantFor(item.propertyId)}
                      >
                        Ajouter un locataire
                      </Button>
                    ) : item.kind === "document_manquant" && item.propertyId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDocumentFor(item.propertyId)}
                      >
                        Ajouter le document
                      </Button>
                    ) : item.kind === "bail_bientot_termine" && item.tenantId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/locataires/${item.tenantId}`} />}
                      >
                        Voir le bail
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    ) : item.kind === "document_expire" && item.propertyId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link href={`/logements/${item.propertyId}?tab=documents`} />
                        }
                      >
                        Voir le document
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" render={<Link href="/travaux" />}>
                        Suivre
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {tenantFor ? (
        <AddTenantDialog
          propertyId={tenantFor}
          showTrigger={false}
          open
          onOpenChange={(open) => {
            if (!open) setTenantFor(null);
          }}
        />
      ) : null}
      {documentFor ? (
        <AddDocumentDialog
          propertyId={documentFor}
          showTrigger={false}
          open
          onOpenChange={(open) => {
            if (!open) setDocumentFor(null);
          }}
        />
      ) : null}
    </Card>
  );
}
