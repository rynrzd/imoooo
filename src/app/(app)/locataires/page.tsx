"use client";

import * as React from "react";
import { Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { TenantCard } from "@/components/tenants/tenant-card";
import { isActiveTenant, tenantFullName } from "@/lib/finance";
import { useAppStore } from "@/lib/store";

export default function TenantsPage() {
  const { data } = useAppStore();
  const [query, setQuery] = React.useState("");

  const matches = (name: string) =>
    name.toLowerCase().includes(query.trim().toLowerCase());

  const active = data.tenants.filter(
    (t) => isActiveTenant(t) && matches(tenantFullName(t))
  );
  const former = data.tenants.filter(
    (t) => !isActiveTenant(t) && matches(tenantFullName(t))
  );

  return (
    <>
      <PageHeader
        title="Locataires"
        description={`${data.tenants.filter(isActiveTenant).length} locataire${data.tenants.filter(isActiveTenant).length > 1 ? "s" : ""} en place`}
      >
        <AddTenantDialog />
      </PageHeader>

      {data.tenants.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aucun locataire pour le moment"
          description="Ajoutez votre premier locataire pour démarrer le suivi des loyers."
        />
      ) : (
        <>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un locataire…"
              className="pl-8"
              aria-label="Rechercher un locataire"
            />
          </div>

          {active.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((tenant) => (
                <TenantCard key={tenant.id} tenant={tenant} showProperty />
              ))}
            </div>
          ) : null}

          {active.length === 0 && former.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucun locataire ne correspond"
              description="Modifiez votre recherche pour retrouver un locataire."
            />
          ) : null}

          {former.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Anciens locataires
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {former.map((tenant) => (
                  <TenantCard key={tenant.id} tenant={tenant} showProperty />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
