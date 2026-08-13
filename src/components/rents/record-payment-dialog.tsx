"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CollectRentSheet } from "./collect-rent-sheet";
import type { RentPayment } from "@/lib/types";

interface RecordPaymentDialogProps {
  payment: RentPayment;
  /** Libellé du déclencheur (par défaut « Encaisser »). */
  triggerLabel?: string;
  /** Style du déclencheur. */
  triggerVariant?: "outline" | "default";
}

/**
 * Bouton d'encaissement d'une échéance précise.
 *
 * Le nom est conservé : sept écrans l'utilisent (liste et tableau des loyers,
 * fiche d'un logement, onglet Location, aperçu, centre d'actions). Seul le
 * contenu a changé — l'ancienne boîte de dialogue à un champ est devenue la
 * feuille montante partagée, avec la date réelle d'encaissement et la note.
 */
export function RecordPaymentDialog({
  payment,
  triggerLabel = "Encaisser",
  triggerVariant = "outline",
}: RecordPaymentDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      {/* Montée seulement à l'ouverture : aucun formulaire en arrière-plan. */}
      {open ? (
        <CollectRentSheet open onOpenChange={setOpen} payment={payment} />
      ) : null}
    </>
  );
}
