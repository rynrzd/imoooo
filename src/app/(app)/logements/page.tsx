"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Hammer,
  LayoutGrid,
  List,
  Percent,
  Plus,
  Search,
  SlidersHorizontal,
  Wallet,
  Landmark,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSheet } from "@/components/shared/filter-sheet";
import { ListRow } from "@/components/shared/list-row";
import { StatCard } from "@/components/shared/stat-card";
import { ImportPropertiesDialog } from "@/components/properties/import-properties-dialog";
import {
  PropertyCard,
  type PropertyEntry,
} from "@/components/properties/property-card";
import { PropertyTable } from "@/components/properties/property-table";
import { currentMonthKey } from "@/lib/dates";
import {
  getLastPaymentDate,
  getOccupancyRate,
  getPropertyFinancials,
  getTenant,
} from "@/lib/finance";
import { getAverageGrossYield, getPortfolioValue } from "@/lib/insights";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PROPERTY_STATUS_LABELS, toOptions } from "@/lib/labels";
import { PROPERTY_TYPES } from "@/lib/property-types";
import { useAppStore } from "@/lib/store";
import type { PropertyStatus, PropertyType } from "@/lib/types";

/** Accès au parcours de création — un lien, pas une modale. */
function NewPropertyLink() {
  return (
    <Link
      href="/logements/nouveau"
      className="inline-flex min-h-11 items-center gap-2 rounded-[0.625rem] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-95"
    >
      <Plus className="size-4" aria-hidden />
      Ajouter un logement
    </Link>
  );
}

const YIELD_OPTIONS = [
  { value: "0", label: "Toutes rentabilités" },
  { value: "3", label: "≥ 3 %" },
  { value: "5", label: "≥ 5 %" },
  { value: "7", label: "≥ 7 %" },
] as const;

interface Filters {
  status: PropertyStatus | "tous";
  city: string;
  type: PropertyType | "tous";
  minYield: (typeof YIELD_OPTIONS)[number]["value"];
  occupation: "tous" | "occupe" | "sans";
  works: "tous" | "actifs";
}

const DEFAULT_FILTERS: Filters = {
  status: "tous",
  city: "toutes",
  type: "tous",
  minYield: "0",
  occupation: "tous",
  works: "tous",
};

export default function PropertiesPage() {
  const { data } = useAppStore();
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"cards" | "list">("cards");
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);

  const month = currentMonthKey();
  const cities = Array.from(new Set(data.properties.map((p) => p.city))).sort();

  // Données pré-calculées par logement (cartes, liste, filtres).
  const entries: PropertyEntry[] = data.properties.map((property) => ({
    property,
    tenant: getTenant(data, property.currentTenantId),
    financials: getPropertyFinancials(data, property),
    monthPayment:
      data.rentPayments.find(
        (p) => p.propertyId === property.id && p.month === month
      ) ?? null,
    lastPaidAt: getLastPaymentDate(data, property.id),
    counts: {
      documents: data.documents.filter((d) => d.propertyId === property.id).length,
      photos: data.photos.filter((p) => p.propertyId === property.id).length,
      works: data.works.filter((w) => w.propertyId === property.id).length,
    },
  }));

  const activeWorksByProperty = new Set(
    data.works.filter((w) => w.status === "en_cours").map((w) => w.propertyId)
  );

  const visible = entries.filter(({ property, financials, tenant }) => {
    const haystack =
      `${property.name} ${property.address} ${property.city} ${property.postalCode}`.toLowerCase();
    if (!haystack.includes(query.trim().toLowerCase())) return false;
    if (filters.status !== "tous" && property.status !== filters.status) return false;
    if (filters.city !== "toutes" && property.city !== filters.city) return false;
    if (filters.type !== "tous" && property.type !== filters.type) return false;
    if (financials.grossYield < Number(filters.minYield)) return false;
    if (filters.occupation === "occupe" && !tenant) return false;
    if (filters.occupation === "sans" && tenant) return false;
    if (filters.works === "actifs" && !activeWorksByProperty.has(property.id))
      return false;
    return true;
  });

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value !== DEFAULT_FILTERS[key as keyof Filters]
  ).length;

  const monthlyRevenue = entries
    .filter((e) => e.tenant)
    .reduce((acc, e) => acc + e.property.rent + e.property.charges, 0);
  const occupancy = getOccupancyRate(data);
  const activeWorks = data.works.filter((w) => w.status === "en_cours").length;

  return (
    <>
      {/* Une seule action principale visible sur téléphone : ajouter un
          logement. Recherche, filtres, bascule d'affichage et import sont
          secondaires — ils passent sous le titre ou restent au bureau. */}
      <PageHeader title="Logements">
        <div className="flex items-center gap-2 max-lg:hidden">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-44 pl-8 sm:w-56"
              aria-label="Rechercher un logement"
            />
          </div>
          <Button
            variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal data-icon="inline-start" />
            Filtres
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-foreground px-1.5 text-[11px] font-medium text-background">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
          <div
            className="flex items-center rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Mode d'affichage"
          >
            <Button
              variant={view === "cards" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Vue cartes"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Vue liste"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List />
            </Button>
          </div>
          <ImportPropertiesDialog />
        </div>
        <NewPropertyLink />
      </PageHeader>

      {data.properties.length > 0 ? (
        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un logement…"
              className="pl-8"
              aria-label="Rechercher un logement"
            />
          </div>
          <FilterSheet
            activeCount={activeFilterCount}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            groups={[
              {
                label: "Statut",
                value: filters.status,
                onChange: (value) =>
                  setFilters((f) => ({ ...f, status: value as Filters["status"] })),
                options: [
                  { value: "tous", label: "Tous les statuts" },
                  ...toOptions(PROPERTY_STATUS_LABELS),
                ],
              },
              {
                label: "Ville",
                value: filters.city,
                onChange: (value) => setFilters((f) => ({ ...f, city: value })),
                options: [
                  { value: "toutes", label: "Toutes les villes" },
                  ...cities.map((c) => ({ value: c, label: c })),
                ],
              },
              {
                label: "Type",
                value: filters.type,
                onChange: (value) =>
                  setFilters((f) => ({ ...f, type: value as Filters["type"] })),
                options: [
                  { value: "tous", label: "Tous les types" },
                  ...PROPERTY_TYPES.map((t) => ({ value: t, label: t })),
                ],
              },
              {
                label: "Occupation",
                value: filters.occupation,
                onChange: (value) =>
                  setFilters((f) => ({ ...f, occupation: value as Filters["occupation"] })),
                options: [
                  { value: "tous", label: "Toute occupation" },
                  { value: "occupe", label: "Avec locataire" },
                  { value: "sans", label: "Sans locataire" },
                ],
              },
              {
                label: "Rentabilité",
                value: filters.minYield,
                onChange: (value) =>
                  setFilters((f) => ({ ...f, minYield: value as Filters["minYield"] })),
                options: YIELD_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              },
            ]}
          />
        </div>
      ) : null}

      {data.properties.length === 0 ? (
        // État vide : ce qu'il faut faire, et ce que Nireo fera ensuite.
        <section className="animate-panel-in space-y-6 py-6">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"
          >
            <Building2 className="size-6" />
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-foreground">
              Ajoutez votre premier logement.
            </h2>
            <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
              Nireo organisera ensuite sa location, ses documents et ses dépenses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NewPropertyLink />
            <ImportPropertiesDialog />
          </div>
        </section>
      ) : (
        <>
          {/* Synthèse du portefeuille */}
          <section
            aria-label="Synthèse du portefeuille"
            className="grid grid-cols-2 gap-4 max-lg:hidden sm:grid-cols-3 xl:grid-cols-6"
          >
            <StatCard
              label="Logements"
              value={String(data.properties.length)}
              icon={Building2}
            />
            <StatCard
              label="Valeur totale"
              value={formatCurrency(getPortfolioValue(data))}
              icon={Landmark}
            />
            <StatCard
              label="Rentabilité moyenne"
              value={formatPercent(getAverageGrossYield(data))}
              icon={Percent}
            />
            <StatCard
              label="Revenus mensuels"
              value={formatCurrency(monthlyRevenue)}
              hint="biens occupés"
              icon={Wallet}
            />
            <StatCard
              label="Occupation"
              value={formatPercent(occupancy, 0)}
              icon={Building2}
              progress={occupancy}
            />
            <StatCard
              label="Travaux en cours"
              value={String(activeWorks)}
              icon={Hammer}
              tone={activeWorks > 0 ? "warning" : "default"}
            />
          </section>

          {/* Barre de filtres */}
          {showFilters ? (
            <section
              aria-label="Filtres"
              className="animate-panel-in flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 max-lg:hidden"
            >
              <Select
                value={filters.status}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, status: (v ?? "tous") as Filters["status"] }))
                }
              >
                <SelectTrigger className="w-40" aria-label="Filtrer par statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {toOptions(PROPERTY_STATUS_LABELS).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.city}
                onValueChange={(v) => setFilters((f) => ({ ...f, city: v ?? "toutes" }))}
              >
                <SelectTrigger className="w-40" aria-label="Filtrer par ville">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes les villes</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.type}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, type: (v ?? "tous") as Filters["type"] }))
                }
              >
                <SelectTrigger className="w-36" aria-label="Filtrer par type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les types</SelectItem>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.minYield}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, minYield: (v ?? "0") as Filters["minYield"] }))
                }
              >
                <SelectTrigger className="w-40" aria-label="Filtrer par rentabilité">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YIELD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.occupation}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    occupation: (v ?? "tous") as Filters["occupation"],
                  }))
                }
              >
                <SelectTrigger className="w-40" aria-label="Filtrer par occupation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toute occupation</SelectItem>
                  <SelectItem value="occupe">Avec locataire</SelectItem>
                  <SelectItem value="sans">Sans locataire</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.works}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, works: (v ?? "tous") as Filters["works"] }))
                }
              >
                <SelectTrigger className="w-40" aria-label="Filtrer par travaux">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Avec ou sans travaux</SelectItem>
                  <SelectItem value="actifs">Chantier en cours</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  <X data-icon="inline-start" />
                  Réinitialiser
                </Button>
              ) : null}
            </section>
          ) : null}

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucun logement ne correspond"
              description="Modifiez votre recherche ou vos filtres pour retrouver vos biens."
            >
              {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Réinitialiser les filtres
                </Button>
              ) : null}
            </EmptyState>
          ) : (
            <>
              {/* Téléphone : une ligne par logement, lisible d'un coup d'œil. */}
              <div className="overflow-hidden rounded-xl border border-border bg-card lg:hidden">
                {visible.map(({ property, tenant }) => (
                  <ListRow
                    key={property.id}
                    href={`/logements/${property.id}`}
                    title={property.name}
                    subtitle={
                      tenant
                        ? `${tenant.firstName} ${tenant.lastName}`
                        : `${property.type} · ${property.city}`
                    }
                    value={property.rent > 0 ? formatCurrency(property.rent) : undefined}
                    hint={PROPERTY_STATUS_LABELS[property.status]}
                    tone={
                      property.status === "loue"
                        ? "positive"
                        : property.status === "vacant"
                          ? "warning"
                          : "default"
                    }
                  />
                ))}
              </div>

              {/* Bureau : cartes ou tableau, au choix — inchangé. */}
              <div className="max-lg:hidden">
                {view === "cards" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visible.map((entry) => (
                      <PropertyCard key={entry.property.id} entry={entry} />
                    ))}
                  </div>
                ) : (
                  <div className="animate-panel-in">
                    <PropertyTable entries={visible} />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
