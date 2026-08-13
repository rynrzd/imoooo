"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/components/form/errors";
import {
  AmountField,
  DateField,
  SegmentedField,
  SelectField,
  TextField,
} from "@/components/form/fields";
import { SheetForm } from "@/components/form/sheet-form";
import { SubmitButton } from "@/components/form/submit-button";
import { todayISO } from "@/lib/dates";
import { parseAmount } from "@/lib/property-types";
import { useAppStore } from "@/lib/store";
import type { WorkStatus } from "@/lib/types";

/**
 * TRAVAUX — deux étapes, pas une.
 *
 *   1. Le chantier        : où, quoi, par qui.
 *   2. Budget et suivi    : combien, quand, où ça en est.
 *
 * Séparer les deux évite l'écran de sept champs où l'on hésitait entre budget
 * prévu et coût réel avant même d'avoir nommé le chantier.
 *
 * Rappel du modèle : créer un chantier crée AUSSI la dépense associée (même
 * montant, catégorie « Travaux »). C'est écrit, pas caché — sinon le total des
 * dépenses semblerait bouger tout seul.
 */

interface AddWorkDialogProps {
  propertyId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function AddWorkDialog({
  propertyId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddWorkDialogProps) {
  const { data, addWork } = useAppStore();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [part, setPart] = React.useState<1 | 2>(1);
  const [target, setTarget] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [status, setStatus] = React.useState<WorkStatus>("planifie");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setPart(1);
      setTarget(
        propertyId ?? (data.properties.length === 1 ? data.properties[0].id : "")
      );
      setTitle("");
      setCompany("");
      setAmount("");
      setDate(todayISO());
      setStatus("planifie");
      setErrors({});
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, propertyId, data.properties]);

  const validatePart1 = () => {
    const next: Record<string, string> = {};
    if (!target) next.target = "Choisissez le logement concerné.";
    if (title.trim().length < 3) next.title = "Nommez ce chantier.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy) return;
    const next: Record<string, string> = {};
    const value = parseAmount(amount);
    if (value === null || value <= 0) next.amount = "Indiquez le budget prévu.";
    if (!date) next.date = "Date requise.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await addWork({
        propertyId: target,
        title: title.trim(),
        company: company.trim(),
        amount: value as number,
        date,
        status,
      });
      toast.success("Chantier ajouté — la dépense correspondante est créée.");
      setOpen(false);
    } catch (e) {
      toast.error(toUserMessage(e, "Ajout impossible."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showTrigger ? (
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Ajouter des travaux
        </Button>
      ) : null}

      <SheetForm
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title={part === 1 ? "Le chantier" : "Budget et suivi"}
        description={
          part === 1
            ? "Étape 1 sur 2 — de quoi s'agit-il, et sur quel logement."
            : "Étape 2 sur 2 — le montant sera aussi enregistré comme dépense de catégorie « Travaux »."
        }
        actions={
          part === 1 ? (
            <>
              <SubmitButton
                type="button"
                onClick={() => {
                  if (validatePart1()) setPart(2);
                }}
              >
                Continuer
              </SubmitButton>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mx-auto block min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              <SubmitButton
                type="button"
                pending={busy}
                onClick={() => void submit()}
              >
                Ajouter le chantier
              </SubmitButton>
              <button
                type="button"
                onClick={() => setPart(1)}
                disabled={busy}
                className="mx-auto block min-h-11 px-3 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                Revenir au chantier
              </button>
            </>
          )
        }
      >
        {part === 1 ? (
          <div className="space-y-5">
            {propertyId ? null : (
              <SelectField
                id="work-property"
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
              id="work-title"
              label="Nom des travaux"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Réfection de la salle de bain"
              error={errors.title}
            />
            <TextField
              id="work-company"
              label="Entreprise ou contact"
              optional
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="SARL Habitat Plus"
            />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <AmountField
                id="work-amount"
                label="Budget prévu"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="4900"
                error={errors.amount}
              />
              <DateField
                id="work-date"
                label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                error={errors.date}
              />
            </div>

            <SegmentedField
              name="work-status"
              label="Où en est le chantier ?"
              value={status}
              onChange={setStatus}
              options={[
                { value: "planifie", label: "Planifié" },
                { value: "en_cours", label: "En cours" },
                { value: "termine", label: "Terminé" },
              ]}
              hint="Le coût réel, les photos et les factures s'ajoutent ensuite depuis la fiche du chantier."
            />
          </div>
        )}
      </SheetForm>
    </>
  );
}
