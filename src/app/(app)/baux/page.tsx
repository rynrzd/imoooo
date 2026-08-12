"use client";

import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListRow } from "@/components/shared/list-row";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { isActiveTenant, tenantFullName } from "@/lib/finance";
import { useAppStore } from "@/lib/store";

/**
 * Baux — la liste des locations en cours, un bail par ligne.
 *
 * Rien de nouveau en base : un bail est la ligne `leases` déjà créée avec le
 * locataire (date d'entrée, loyer, charges, dépôt), et son document signé est
 * le document de catégorie « bail » du logement. Cet écran ne fait que les
 * réunir — jusqu'ici il fallait ouvrir chaque logement pour les voir.
 */
export default function LeasesPage() {
  const { data } = useAppStore();

  const active = data.tenants.filter(isActiveTenant);
  const former = data.tenants.filter((t) => !isActiveTenant(t));

  const propertyOf = (propertyId: string) =>
    data.properties.find((p) => p.id === propertyId) ?? null;
  const hasSignedLease = (propertyId: string) =>
    data.documents.some((d) => d.propertyId === propertyId && d.category === "bail");

  return (
    <>
      <PageHeader
        title="Baux"
        description={
          active.length > 0
            ? `${active.length} bail${active.length > 1 ? "s" : ""} en cours`
            : undefined
        }
      >
        <AddTenantDialog />
      </PageHeader>

      {data.tenants.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Aucun bail pour le moment"
          description="Un bail se crée en ajoutant un locataire à l'un de vos logements."
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              {active.map((tenant) => {
                const property = propertyOf(tenant.propertyId);
                const signed = hasSignedLease(tenant.propertyId);
                return (
                  <ListRow
                    key={tenant.id}
                    href={`/logements/${tenant.propertyId}?tab=location`}
                    title={tenantFullName(tenant)}
                    subtitle={`${property?.name ?? "Logement"} · depuis le ${formatDate(tenant.entryDate)}`}
                    value={formatCurrency(tenant.rent + tenant.charges)}
                    hint={signed ? "Document du bail ajouté" : "Document du bail manquant"}
                    tone={signed ? "default" : "warning"}
                  />
                );
              })}
            </section>
          ) : null}

          {former.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Baux terminés</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {former.map((tenant) => {
                  const property = propertyOf(tenant.propertyId);
                  return (
                    <ListRow
                      key={tenant.id}
                      href={`/logements/${tenant.propertyId}?tab=location`}
                      title={tenantFullName(tenant)}
                      subtitle={`${property?.name ?? "Logement"} · sorti le ${tenant.exitDate ? formatDate(tenant.exitDate) : "—"}`}
                      value={formatCurrency(tenant.rent + tenant.charges)}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Les documents signés sont rangés dans la{" "}
            <Link href="/documents" className="text-foreground underline-offset-2 hover:underline">
              bibliothèque
            </Link>
            , catégorie « Bail ».
          </p>
        </div>
      )}
    </>
  );
}
