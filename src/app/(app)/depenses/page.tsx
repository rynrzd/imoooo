"use client";

import * as React from "react";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSheet } from "@/components/shared/filter-sheet";
import { ListRow } from "@/components/shared/list-row";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { useAppStore } from "@/lib/store";

/**
 * Dépenses — toutes celles du patrimoine, au même endroit.
 *
 * Elles existaient déjà (table `expenses`, dialogue d'ajout, onglet Finances
 * d'un logement) mais n'avaient aucune vue d'ensemble : il fallait ouvrir
 * chaque bien. Aucune donnée ni règle nouvelle ici, uniquement la lecture.
 */
export default function ExpensesPage() {
  const { data } = useAppStore();
  const [property, setProperty] = React.useState("tous");
  const [category, setCategory] = React.useState("toutes");

  const visible = data.expenses
    .filter((e) => (property === "tous" ? true : e.propertyId === property))
    .filter((e) => (category === "toutes" ? true : e.category === category))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = visible.reduce((sum, e) => sum + e.amount, 0);
  const { pageItems, page, pageCount, setPage, total: count } = usePagination(visible, 25);

  return (
    <>
      <PageHeader title="Dépenses">
        <AddExpenseDialog />
      </PageHeader>

      {data.expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aucune dépense enregistrée."
          description="Votre résultat se précisera dès votre première dépense : taxe foncière, assurance, travaux, honoraires."
        >
          <AddExpenseDialog />
        </EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(total)}
              </span>{" "}
              sur {count} dépense{count > 1 ? "s" : ""}
            </p>
            <FilterSheet
              activeCount={(property !== "tous" ? 1 : 0) + (category !== "toutes" ? 1 : 0)}
              onReset={() => {
                setProperty("tous");
                setCategory("toutes");
              }}
              groups={[
                {
                  label: "Logement",
                  value: property,
                  onChange: setProperty,
                  options: [
                    { value: "tous", label: "Tous les logements" },
                    ...data.properties.map((p) => ({ value: p.id, label: p.name })),
                  ],
                },
                {
                  label: "Catégorie",
                  value: category,
                  onChange: setCategory,
                  options: [
                    { value: "toutes", label: "Toutes les catégories" },
                    ...Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ],
                },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Aucune dépense ne correspond"
              description="Modifiez vos filtres pour retrouver une dépense."
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {pageItems.map((expense) => {
                  const bien = data.properties.find((p) => p.id === expense.propertyId);
                  return (
                    <ListRow
                      key={expense.id}
                      href={`/logements/${expense.propertyId}?tab=finances`}
                      title={expense.label}
                      subtitle={`${bien?.name ?? "Logement"} · ${formatDate(expense.date)}`}
                      value={formatCurrency(expense.amount)}
                      hint={EXPENSE_CATEGORY_LABELS[expense.category]}
                    />
                  );
                })}
              </div>
              <PaginationBar
                page={page}
                pageCount={pageCount}
                total={count}
                onPageChange={setPage}
                label="dépenses"
              />
            </>
          )}
        </>
      )}
    </>
  );
}
