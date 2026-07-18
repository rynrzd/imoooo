"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getProperty } from "@/lib/finance";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Tenant } from "@/lib/types";

interface TenantCardProps {
  tenant: Tenant;
  /** Affiche le logement associé (vue globale Locataires). */
  showProperty?: boolean;
}

/** Fiche locataire : contact, dates, conditions financières, accès au dossier. */
export function TenantCard({ tenant, showProperty = false }: TenantCardProps) {
  const { data } = useAppStore();
  const property = getProperty(data, tenant.propertyId);
  const active = tenant.exitDate === null;

  return (
    <Card className="card-lift py-4">
      <CardContent className="flex h-full flex-col gap-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                {initials(tenant.firstName, tenant.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {tenant.firstName} {tenant.lastName}
              </p>
              {showProperty && property ? (
                <Link
                  href={`/logements/${property.id}`}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {property.name}
                </Link>
              ) : null}
            </div>
          </div>
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

        <div className="grid gap-1.5 text-sm">
          <a
            href={`tel:${tenant.phone.replaceAll(" ", "")}`}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="size-3.5" />
            {tenant.phone}
          </a>
          <a
            href={`mailto:${tenant.email}`}
            className="flex items-center gap-2 truncate text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{tenant.email}</span>
          </a>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Entrée le {formatDate(tenant.entryDate)}
            {tenant.exitDate ? ` — sortie le ${formatDate(tenant.exitDate)}` : ""}
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Loyer</p>
            <p className="font-medium tabular-nums text-foreground">
              {formatCurrency(tenant.rent)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Charges</p>
            <p className="font-medium tabular-nums text-foreground">
              {formatCurrency(tenant.charges)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Dépôt de garantie</p>
            <p className="font-medium tabular-nums text-foreground">
              {formatCurrency(tenant.deposit)}
            </p>
          </div>
        </div>

        <div className="mt-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            render={<Link href={`/locataires/${tenant.id}`} />}
          >
            Ouvrir le dossier
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
