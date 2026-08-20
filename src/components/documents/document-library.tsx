"use client";

import * as React from "react";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { DropZone } from "@/components/shared/drop-zone";
import { FilterSheet } from "@/components/shared/filter-sheet";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { DOCUMENT_GROUPS, type DocumentGroupId } from "@/lib/documents/groups";
import { useAppStore } from "@/lib/store";

import { AddDocumentDialog } from "./add-document-dialog";
import { DocumentList } from "./document-list";

interface DocumentLibraryProps {
  /** Restreint la bibliothèque à un logement (onglet du dossier). */
  propertyId?: string;
}

/**
 * Bibliothèque documentaire : recherche, filtres par catégorie et logement,
 * dépôt de fichier par glisser-déposer.
 */
export function DocumentLibrary({ propertyId }: DocumentLibraryProps) {
  const { data } = useAppStore();
  const [query, setQuery] = React.useState("");
  // On filtre par SECTION (les cinq de l'espace documentaire) et non par
  // catégorie : c'est le rangement que l'utilisateur voit à l'écran.
  const [section, setSection] = React.useState<DocumentGroupId | "toutes">("toutes");
  const [tenantFilter, setTenantFilter] = React.useState<string>("tous");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("tous");
  // Fichier déposé : ouvre le dialogue d'ajout pré-rempli.
  const [droppedFile, setDroppedFile] = React.useState<File | null>(null);

  const scoped = propertyId
    ? data.documents.filter((d) => d.propertyId === propertyId)
    : data.documents;

  const visible = scoped.filter((document) => {
    const matchesQuery = document.name
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const groupe = DOCUMENT_GROUPS.find((g) => g.id === section);
    const matchesSection = section === "toutes" || Boolean(groupe?.categories.includes(document.category));
    // Le locataire n'est pas porté par le document : il vient de son
    // logement (cf. lib/documents/groups). Filtrer par locataire revient
    // donc à filtrer sur les logements qu'il occupe.
    const matchesTenant =
      tenantFilter === "tous" ||
      data.tenants.some(
        (t) => t.id === tenantFilter && t.propertyId === document.propertyId
      );
    const matchesProperty =
      propertyFilter === "tous" || document.propertyId === propertyFilter;
    return matchesQuery && matchesSection && matchesProperty && matchesTenant;
  });

  // Pagination d'affichage : filtres et recherche restent appliqués à tout.
  const { pageItems, page, pageCount, setPage, total } = usePagination(visible, 25);

  const activeFilters =
    (section === "toutes" ? 0 : 1) +
    (propertyFilter === "tous" ? 0 : 1) +
    (tenantFilter === "tous" ? 0 : 1);

  // Sans recherche ni filtre, chaque section n'affiche que ses documents les
  // plus récents : la page se lit d'un coup d'œil. Dès qu'on cherche, on
  // veut TOUS les résultats, sans « voir tout » à cliquer.
  const filtre = activeFilters > 0 || query.trim().length > 0;

  // Locataires proposés au filtre : uniquement ceux qui ont un logement.
  const locataires = data.tenants
    .filter((t) => data.properties.some((pr) => pr.id === t.propertyId))
    .map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}`.trim() }));

  return (
    <div className="space-y-4">
      {/* Le glisser-déposer suppose un pointeur : inutile au doigt, où il
          occupait le premier tiers de l'écran. Le bouton « Ajouter » de
          l'en-tête ouvre le même dialogue. */}
      <div className="max-lg:hidden">
        <DropZone
          label="Glissez-déposez un fichier ici"
          hint="ou cliquez pour choisir un fichier — PDF, image ou Word"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          onFile={setDroppedFile}
        />
      </div>
      <AddDocumentDialog
        propertyId={propertyId}
        droppedFile={droppedFile}
        open={droppedFile !== null}
        onOpenChange={(open) => {
          if (!open) setDroppedFile(null);
        }}
        showTrigger={false}
      />

      {/* Barre d'outils : recherche + filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un document…"
            className="pl-8"
            aria-label="Rechercher un document"
          />
        </div>
        {/* Filtres : une feuille au doigt, les listes déroulantes au bureau. */}
        <div className="lg:hidden">
          <FilterSheet
            activeCount={activeFilters}
            onReset={() => {
              setSection("toutes");
              setPropertyFilter("tous");
              setTenantFilter("tous");
            }}
            groups={[
              {
                label: "Section",
                value: section,
                onChange: (value) => setSection(value as DocumentGroupId | "toutes"),
                options: [
                  { value: "toutes", label: "Toutes les sections" },
                  ...DOCUMENT_GROUPS.map((g) => ({ value: g.id, label: g.label })),
                ],
              },
              ...(locataires.length > 0
                ? [
                    {
                      label: "Locataire",
                      value: tenantFilter,
                      onChange: setTenantFilter,
                      options: [{ value: "tous", label: "Tous les locataires" }, ...locataires],
                    },
                  ]
                : []),
              ...(propertyId
                ? []
                : [
                    {
                      label: "Logement",
                      value: propertyFilter,
                      onChange: setPropertyFilter,
                      options: [
                        { value: "tous", label: "Tous les logements" },
                        ...data.properties.map((p) => ({ value: p.id, label: p.name })),
                      ],
                    },
                  ]),
            ]}
          />
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 max-lg:hidden sm:justify-end">
          <Select
            value={section}
            onValueChange={(value) =>
              setSection((value ?? "toutes") as DocumentGroupId | "toutes")
            }
          >
            <SelectTrigger className="w-44" aria-label="Filtrer par section">
              <SelectValue>
                {(v) =>
                  DOCUMENT_GROUPS.find((g) => g.id === v)?.label ?? "Toutes les sections"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes les sections</SelectItem>
              {DOCUMENT_GROUPS.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {locataires.length > 0 ? (
            <Select
              value={tenantFilter}
              onValueChange={(value) => setTenantFilter(value ?? "tous")}
            >
              <SelectTrigger className="w-44" aria-label="Filtrer par locataire">
                <SelectValue>
                  {(v) =>
                    locataires.find((t) => t.value === v)?.label ?? "Tous les locataires"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les locataires</SelectItem>
                {locataires.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {!propertyId ? (
            <Select
              value={propertyFilter}
              onValueChange={(value) => setPropertyFilter(value ?? "tous")}
            >
              <SelectTrigger className="w-44" aria-label="Filtrer par logement">
                <SelectValue>
                  {(v) =>
                    data.properties.find((pr) => pr.id === v)?.name ?? "Tous les logements"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les logements</SelectItem>
                {data.properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            scoped.length === 0
              ? "Aucun document pour le moment."
              : "Aucun document ne correspond."
          }
          description={
            scoped.length === 0
              ? "Ajoutez un bail, une assurance ou un diagnostic au bon logement."
              : "Modifiez votre recherche ou vos filtres pour retrouver un document."
          }
        >
          {scoped.length === 0 ? (
            <AddDocumentDialog propertyId={propertyId} />
          ) : null}
        </EmptyState>
      ) : (
        <>
          <DocumentList
            documents={pageItems}
            showProperty={!propertyId && propertyFilter === "tous"}
            apercuParSection={filtre ? null : 4}
            montrerSectionsVides={!filtre && !propertyId}
          />
          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={total}
            onPageChange={setPage}
            label="documents"
          />
        </>
      )}
    </div>
  );
}
