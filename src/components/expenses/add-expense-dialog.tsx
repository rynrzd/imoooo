"use client";

import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/components/form/errors";
import {
  AmountField,
  DateField,
  FileField,
  MoreDetails,
  SelectField,
  TextField,
} from "@/components/form/fields";
import { SheetForm } from "@/components/form/sheet-form";
import { SubmitButton } from "@/components/form/submit-button";
import { todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { parseAmount } from "@/lib/property-types";
import { useAppStore } from "@/lib/store";
import type { Expense, ExpenseCategory } from "@/lib/types";

/**
 * DÉPENSE — court, et immédiatement répercuté.
 *
 * Les catégories sont celles de la base (`EXPENSE_CATEGORY_LABELS`), donc
 * exactement celles que les statistiques agrègent : une dépense saisie ici
 * apparaît dans le même seau que celui qu'affiche l'écran Statistiques.
 *
 * Le store met à jour `expenses` localement dès l'écriture réussie : résultat
 * net, statistiques, fiche du logement et activité récente sont tous dérivés
 * de ce tableau — ils changent donc dans la même image, sans rechargement.
 */

interface AddExpenseDialogProps {
  propertyId?: string;
  /** En édition, la dépense à modifier. */
  expense?: Expense;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function AddExpenseDialog({
  propertyId,
  expense,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddExpenseDialogProps) {
  const { data, addExpense, updateExpense } = useAppStore();
  const isEdit = Boolean(expense);

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [target, setTarget] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory>("autres");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [supplier, setSupplier] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setTarget(
        expense?.propertyId ??
          propertyId ??
          (data.properties.length === 1 ? data.properties[0].id : "")
      );
      setLabel(expense?.label ?? "");
      setCategory(expense?.category ?? "autres");
      setAmount(expense ? String(expense.amount) : "");
      setDate(expense?.date ?? todayISO());
      setSupplier(expense?.supplier ?? "");
      setFile(null);
      setErrors({});
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, expense, propertyId, data.properties]);

  const submit = async () => {
    if (busy) return;
    const next: Record<string, string> = {};
    if (!target) next.target = "Choisissez le logement concerné.";
    if (label.trim().length < 2) next.label = "Donnez un libellé à cette dépense.";
    const value = parseAmount(amount);
    if (value === null || value <= 0) next.amount = "Indiquez le montant.";
    if (!date) next.date = "Date requise.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const payload = {
        propertyId: target,
        label: label.trim(),
        category,
        amount: value as number,
        date,
        supplier: supplier.trim(),
      };
      if (expense) {
        await updateExpense(expense.id, payload, file ?? undefined);
        toast.success("Dépense mise à jour.");
      } else {
        await addExpense(payload, file ?? undefined);
        toast.success("Dépense enregistrée.");
      }
      setOpen(false);
    } catch (e) {
      toast.error(toUserMessage(e, "Enregistrement impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showTrigger ? (
        isEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier la dépense ${expense?.label ?? ""}`}
            onClick={() => setOpen(true)}
          >
            <Pencil />
          </Button>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            Ajouter une dépense
          </Button>
        )
      ) : null}

      <SheetForm
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title={isEdit ? "Modifier la dépense" : "Nouvelle dépense"}
        description="Elle sera immédiatement prise en compte dans votre résultat net et vos statistiques."
        actions={
          <>
            <SubmitButton
              type="button"
              pending={busy}
              onClick={() => void submit()}
            >
              {isEdit ? "Enregistrer" : "Ajouter la dépense"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="mx-auto block min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              Annuler
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {propertyId && !isEdit ? null : (
            <SelectField
              id="exp-property"
              label="Logement"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Choisir un logement"
              options={data.properties.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              error={errors.target}
            />
          )}

          <TextField
            id="exp-label"
            label="Libellé"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Taxe foncière 2026"
            error={errors.label}
          />

          <SelectField
            id="exp-category"
            label="Catégorie"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            options={toOptions(EXPENSE_CATEGORY_LABELS)}
            hint="Elle détermine où la dépense apparaît dans vos statistiques."
          />

          <div className="grid grid-cols-2 gap-4">
            <AmountField
              id="exp-amount"
              label="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="890"
              error={errors.amount}
            />
            <DateField
              id="exp-date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={errors.date}
            />
          </div>

          <FileField
            id="exp-receipt"
            label={
              expense?.receiptPath ? "Remplacer le justificatif" : "Justificatif"
            }
            optional
            file={file}
            onFile={setFile}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
          />

          <MoreDetails>
            <TextField
              id="exp-supplier"
              label="Fournisseur"
              optional
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Trésor public"
            />
          </MoreDetails>
        </div>
      </SheetForm>
    </>
  );
}
