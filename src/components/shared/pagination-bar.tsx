"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pagination client légère pour les listes du store.
 * Revient automatiquement à la page 1 quand la liste filtrée change de
 * taille (recherche, filtre) pour ne jamais afficher une page vide.
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Filtre/recherche modifiés → la page est bornée par dérivation
  // (pas de setState dans un effet : évite les rendus en cascade).
  const safePage = Math.min(page, pageCount);

  const pageItems = React.useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return { pageItems, page: safePage, pageCount, setPage, total: items.length };
}

export function PaginationBar({
  page,
  pageCount,
  total,
  onPageChange,
  label = "éléments",
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 pt-1"
    >
      <p className="text-xs text-muted-foreground">
        Page {page} sur {pageCount} · {total} {label}
      </p>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft data-icon="inline-start" />
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          Suivant
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}
