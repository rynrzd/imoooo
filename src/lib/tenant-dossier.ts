"use client";

import * as React from "react";

/**
 * Enrichissements locaux du dossier locataire (notes privées, garant).
 * Stockés dans le navigateur : aucun impact sur le modèle de données serveur.
 */

const NOTES_PREFIX = "immopilot:tenant-notes:";
const GUARANTOR_PREFIX = "immopilot:guarantor:";

export interface GuarantorInfo {
  name: string;
  phone?: string;
  email?: string;
}

/** Notes privées d'un locataire, persistées localement. */
export function useTenantNotes(tenantId: string) {
  const key = `${NOTES_PREFIX}${tenantId}`;
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    // Lecture différée d'un tick : évite un setState synchrone dans l'effet.
    const id = window.setTimeout(() => {
      try {
        setNotes(window.localStorage.getItem(key) ?? "");
      } catch {
        // Stockage indisponible (navigation privée…) : notes non persistées.
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [key]);

  const saveNotes = React.useCallback(() => {
    try {
      window.localStorage.setItem(key, notes);
    } catch {
      // Ignoré : l'utilisateur garde ses notes le temps de la session.
    }
  }, [key, notes]);

  return { notes, setNotes, saveNotes };
}

/**
 * Garant renseigné à la création du bail (clé stable : e-mail du locataire).
 * Lu après montage pour éviter tout décalage d'hydratation.
 */
export function useGuarantor(tenantEmail: string): GuarantorInfo | null {
  const [guarantor, setGuarantor] = React.useState<GuarantorInfo | null>(null);

  React.useEffect(() => {
    // Lecture différée d'un tick : évite un setState synchrone dans l'effet.
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(`${GUARANTOR_PREFIX}${tenantEmail}`);
        if (!raw) {
          setGuarantor(null);
          return;
        }
        const parsed = JSON.parse(raw) as GuarantorInfo;
        setGuarantor(parsed.name ? parsed : null);
      } catch {
        setGuarantor(null);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [tenantEmail]);

  return guarantor;
}

export function saveGuarantor(tenantEmail: string, info: GuarantorInfo): void {
  try {
    window.localStorage.setItem(
      `${GUARANTOR_PREFIX}${tenantEmail}`,
      JSON.stringify(info)
    );
  } catch {
    // Stockage indisponible : information non persistée.
  }
}
