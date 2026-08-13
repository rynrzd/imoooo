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
import { DOCUMENT_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { DocumentCategory } from "@/lib/types";
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
  const [category, setCategory] = React.useState<DocumentCategory | "toutes">("toutes");
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
    const matchesCategory = category === "toutes" || document.category === category;
    const matchesProperty =
      propertyFilter === "tous" || document.propertyId === propertyFilter;
    return matchesQuery && matchesCategory && matchesProperty;
  });

  // Pagination d'affichage : filtres et recherche restent appliqués à tout.
  const { pageItems, page, pageCount, setPage, total } = usePagination(visible, 25);

  const activeFilters =
    (category === "toutes" ? 0 : 1) + (propertyFilter === "tous" ? 0 : 1);

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
              setCategory("toutes");
              setPropertyFilter("tous");
            }}
            groups={[
              {
                label: "Catégorie",
                value: category,
                onChange: (value) => setCategory(value as DocumentCategory | "toutes"),
                options: [
                  { value: "toutes", label: "Toutes les catégories" },
                  ...toOptions(DOCUMENT_CATEGORY_LABELS),
                ],
              },
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
            value={category}
            onValueChange={(value) =>
              setCategory((value ?? "toutes") as DocumentCategory | "toutes")
            }
          >
            <SelectTrigger className="w-44" aria-label="Filtrer par catégorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes les catégories</SelectItem>
              {toOptions(DOCUMENT_CATEGORY_LABELS).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!propertyId ? (
            <Select
              value={propertyFilter}
              onValueChange={(value) => setPropertyFilter(value ?? "tous")}
            >
              <SelectTrigger className="w-44" aria-label="Filtrer par logement">
                <SelectValue />
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
