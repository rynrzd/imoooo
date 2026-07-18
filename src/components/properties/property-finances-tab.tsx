"use client";

import * as React from "react";
import { CheckCircle2, Download, Hammer, Receipt, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { StatCard } from "@/components/shared/stat-card";
import { AddWorkDialog } from "@/components/works/add-work-dialog";
import { WorkList } from "@/components/works/work-list";
import { currentMonthKey, yearOf } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { Expense, Property } from "@/lib/types";

interface PropertyFinancesTabProps {
  property: Property;
}

/** Onglet « Dépenses et travaux » : vision financière + suivi de chantier. */
export function PropertyFinancesTab({ property }: PropertyFinancesTabProps) {
  const { data, deleteExpense, getReceiptUrl } = useAppStore();
  const year = yearOf(currentMonthKey());
  const [deleteTarget, setDeleteTarget] = React.useState<Expense | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const expenses = data.expenses
    .filter((e) => e.propertyId === property.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const works = data.works.filter((w) => w.propertyId === property.id);
  // Totaux sur la liste complète ; affichage du tableau paginé.
  const {
    pageItems: pagedExpenses,
    page: expensePage,
    pageCount: expensePageCount,
    setPage: setExpensePage,
    total: expenseTotal,
  } = usePagination(expenses, 20);

  const yearExpenses = expenses
    .filter((e) => yearOf(e.date.slice(0, 7)) === year)
    .reduce((acc, e) => acc + e.amount, 0);
  const worksBudget = works.reduce((acc, w) => acc + (w.actualCost ?? w.amount), 0);
  const activeWorks = works.filter((w) => w.status === "en_cours").length;
  const doneWorks = works.filter((w) => w.status === "termine").length;

  const handleDownloadReceipt = async (expense: Expense) => {
    setBusyId(expense.id);
    try {
      const url = await getReceiptUrl(expense);
      if (url) {
        window.open(url, "_blank", "noopener");
      } else {
        toast.info("Aucun justificatif associé à cette dépense.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (expense: Expense) => {
    setBusyId(expense.id);
    try {
      await deleteExpense(expense.id);
      toast.success("Dépense supprimée.");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusyId(null);
    }
  };

  if (expenses.length === 0 && works.length === 0) {
    return (
      <EmptyState
        icon={Hammer}
        title="Aucune dépense ni travaux"
        description="Déclarez vos chantiers et dépenses : ils alimentent le résultat net et les statistiques du bien."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <AddWorkDialog propertyId={property.id} />
          <AddExpenseDialog propertyId={property.id} />
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Dépenses et travaux
          </h2>
          <p className="text-xs text-muted-foreground">
            Chaque chantier crée automatiquement la dépense associée.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddExpenseDialog propertyId={property.id} />
          <AddWorkDialog propertyId={property.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label={`Dépenses ${year}`}
          value={formatCurrency(yearExpenses)}
          icon={Receipt}
          tone="negative"
        />
        <StatCard
          label="Coût des travaux"
          value={formatCurrency(worksBudget)}
          hint="coût réel si connu, sinon budget"
          icon={Hammer}
        />
        <StatCard
          label="Chantiers actifs"
          value={String(activeWorks)}
          icon={Timer}
          tone={activeWorks > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Chantiers terminés"
          value={String(doneWorks)}
          icon={CheckCircle2}
          tone="positive"
        />
      </div>

      {works.length > 0 ? <WorkList works={works} /> : null}

      {expenses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Détail des dépenses</CardTitle>
            <p className="text-xs text-muted-foreground">
              Chaque dépense réduit le résultat net du logement.
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="max-md:hidden">Fournisseur</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="w-24 pr-3" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedExpenses.map((expense) => {
                    const linkedToWork = Boolean(expense.maintenanceRecordId);
                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="pl-4 text-muted-foreground">
                          {formatDate(expense.date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {expense.label}
                          {linkedToWork ? (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                              via travaux
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {EXPENSE_CATEGORY_LABELS[expense.category]}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-md:hidden">
                          {expense.supplier || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          −{formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="pr-3 text-right">
                          <span className="inline-flex items-center gap-0.5">
                            {expense.receiptPath ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Justificatif — ${expense.label}`}
                                disabled={busyId === expense.id}
                                onClick={() => void handleDownloadReceipt(expense)}
                              >
                                <Download />
                              </Button>
                            ) : null}
                            {/* Les dépenses liées à un chantier se gèrent via celui-ci. */}
                            {!linkedToWork ? (
                              <>
                                <AddExpenseDialog expense={expense} />
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Supprimer ${expense.label}`}
                                  className="text-muted-foreground hover:text-destructive"
                                  disabled={busyId === expense.id}
                                  onClick={() => setDeleteTarget(expense)}
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            ) : null}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4">
              <PaginationBar
                page={expensePage}
                pageCount={expensePageCount}
                total={expenseTotal}
                onPageChange={setExpensePage}
                label="dépenses"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Confirmation de suppression d'une dépense */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette dépense ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.label} » sera définitivement supprimée
              {deleteTarget?.receiptPath ? ", ainsi que son justificatif" : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteTarget !== null && busyId === deleteTarget.id}
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
              }}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
