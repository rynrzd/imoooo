"use client";

import * as React from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/components/form/errors";
import {
  AmountField,
  DateField,
  MoreDetails,
  SelectField,
  TextAreaField,
} from "@/components/form/fields";
import { SheetForm } from "@/components/form/sheet-form";
import { SubmitButton } from "@/components/form/submit-button";
import { todayISO } from "@/lib/dates";
import { formatCurrency, formatMonth } from "@/lib/format";
import { parseAmount } from "@/lib/property-types";
import { useAppStore } from "@/lib/store";
import type { RentPayment } from "@/lib/types";

/**
 * ENCAISSEMENT D'UN LOYER — une feuille montante, pas un formulaire géant.
 *
 * Cinq lignes maximum, toutes réellement présentes dans le modèle :
 * logement, période, montant, date d'encaissement, note. Il n'y a PAS de champ
 * « moyen de paiement » : la table `rent_payments` n'en a pas, et inventer un
 * champ qui ne serait stocké nulle part serait pire que de ne pas le proposer.
 *
 * Les statuts (payé, partiel, en attente, retard) restent calculés là où ils
 * l'ont toujours été — `recordPayment` côté serveur. L'interface se contente
 * d'afficher ce que le serveur renvoie : elle ne peut pas le contredire.
 */
export function CollectRentSheet({
  open,
  onOpenChange,
  /** Échéance imposée (depuis la liste des loyers ou la fiche d'un logement). */
  payment: fixedPayment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: RentPayment;
}) {
  const { data, markRentPaid } = useAppStore();

  // Échéances encore ouvertes, de la plus ancienne à la plus récente : c'est
  // celle qu'on encaisse en priorité.
  const openPayments = React.useMemo(
    () =>
      data.rentPayments
        .filter((p) => p.received < p.expected)
        .sort((a, b) => a.month.localeCompare(b.month)),
    [data.rentPayments]
  );

  const [propertyId, setPropertyId] = React.useState("");
  const [paymentId, setPaymentId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayISO());
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Chaque ouverture repart d'un état propre et pré-rempli. Différé d'un tick :
  // aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const initial = fixedPayment ?? openPayments[0] ?? null;
      setPropertyId(initial?.propertyId ?? "");
      setPaymentId(initial?.id ?? "");
      setAmount(
        initial ? String(Math.max(0, initial.expected - initial.received)) : ""
      );
      setPaidAt(todayISO());
      setComment("");
      setError(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, fixedPayment, openPayments]);

  const propertiesWithDue = React.useMemo(() => {
    const ids = new Set(openPayments.map((p) => p.propertyId));
    return data.properties.filter((p) => ids.has(p.id));
  }, [data.properties, openPayments]);

  const periodOptions = openPayments
    .filter((p) => p.propertyId === propertyId)
    .map((p) => ({
      value: p.id,
      label: `${formatMonth(p.month)} — reste ${formatCurrency(p.expected - p.received)}`,
    }));

  const selected =
    data.rentPayments.find((p) => p.id === paymentId) ?? fixedPayment ?? null;
  const remaining = selected ? selected.expected - selected.received : 0;

  const submit = async () => {
    if (busy) return;
    if (!selected) {
      setError("Choisissez l'échéance concernée.");
      return;
    }
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      setError("Indiquez le montant reçu.");
      return;
    }
    if (value > remaining) {
      setError(
        `Le reste dû est de ${formatCurrency(remaining)}. Corrigez le montant, ou modifiez l'échéance depuis la page Loyers.`
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await markRentPaid(selected.id, value, {
        paidAt,
        comment: comment.trim() || undefined,
      });
      // Les totaux du mois et l'activité récente sont dérivés du store :
      // ils sont donc à jour dès cette ligne, sans rechargement.
      toast.success(
        `${formatCurrency(value)} encaissé — ${formatMonth(selected.month)}.`
      );
      onOpenChange(false);
    } catch (e) {
      setError(toUserMessage(e, "Enregistrement impossible."));
    } finally {
      setBusy(false);
    }
  };

  const locked = Boolean(fixedPayment);
  const property = data.properties.find((p) => p.id === propertyId) ?? null;

  return (
    <SheetForm
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title="Ajouter un encaissement"
      description={
        selected
          ? `Reste dû : ${formatCurrency(remaining)}.`
          : "Aucune échéance en attente pour le moment."
      }
      actions={
        <>
          <SubmitButton
            type="button"
            pending={busy}
            disabled={!selected}
            onClick={() => void submit()}
          >
            Enregistrer l&apos;encaissement
          </SubmitButton>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="mx-auto block min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Annuler
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {openPayments.length === 0 && !fixedPayment ? (
          <p className="text-sm text-muted-foreground">
            Tous vos loyers sont encaissés. Les prochaines échéances
            apparaîtront ici au fil des mois.
          </p>
        ) : (
          <>
            {locked ? (
              <div className="rounded-[0.625rem] bg-primary-soft px-3.5 py-3">
                <p className="text-sm font-medium text-foreground">
                  {property?.name ?? "Logement"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected ? formatMonth(selected.month) : ""}
                </p>
              </div>
            ) : (
              <>
                <SelectField
                  id="collect-property"
                  label="Logement"
                  value={propertyId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPropertyId(nextId);
                    const first = openPayments.find(
                      (p) => p.propertyId === nextId
                    );
                    setPaymentId(first?.id ?? "");
                    setAmount(
                      first
                        ? String(Math.max(0, first.expected - first.received))
                        : ""
                    );
                  }}
                  placeholder="Choisir un logement"
                  options={propertiesWithDue.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />

                <SelectField
                  id="collect-period"
                  label="Période"
                  value={paymentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPaymentId(nextId);
                    const next = openPayments.find((p) => p.id === nextId);
                    setAmount(
                      next
                        ? String(Math.max(0, next.expected - next.received))
                        : ""
                    );
                  }}
                  placeholder="Choisir une échéance"
                  options={periodOptions}
                  hint="La plus ancienne échéance ouverte est proposée d'abord."
                />
              </>
            )}

            <AmountField
              id="collect-amount"
              label="Montant reçu"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              hint={
                selected && remaining > 0
                  ? `Un montant inférieur enregistre un paiement partiel.`
                  : undefined
              }
            />

            <DateField
              id="collect-date"
              label="Date d'encaissement"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              max={todayISO()}
            />

            <MoreDetails label="Ajouter une note">
              <TextAreaField
                id="collect-note"
                label="Note"
                optional
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Virement, chèque n°…"
              />
            </MoreDetails>

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </SheetForm>
  );
}
