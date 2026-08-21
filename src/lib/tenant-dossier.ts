"use client";

import * as React from "react";

/**
 * Enrichissements LOCAUX du dossier locataire (notes privées, garant).
 *
 * ⚠ Ces données vivent uniquement dans le `localStorage` du navigateur.
 * Conséquences qu'il faut assumer devant l'utilisateur, et donc lui dire :
 *  • elles ne suivent pas le compte : un autre appareil ne les voit pas ;
 *  • elles disparaissent avec les données de navigation ;
 *  • elles ne figurent NI dans l'export de données, NI dans la suppression
 *    de compte (qui ne touche que la base et le Storage) ;
 *  • elles restent lisibles après déconnexion sur un poste partagé.
 *
 * `saveNotes` retourne donc un booléen : l'écriture peut échouer (navigation
 * privée Safari, quota plein) et l'appelant doit pouvoir le dire au lieu
 * d'afficher un succès de principe.
 *
 * Le jour où ces champs doivent réellement suivre le compte, la seule
 * solution correcte est une colonne en base — pas un stockage navigateur
 * plus malin.
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

  /** true si l'écriture a réellement eu lieu. */
  const saveNotes = React.useCallback((): boolean => {
    try {
      window.localStorage.setItem(key, notes);
      return true;
    } catch {
      // Navigation privée ou quota plein : l'écriture n'a PAS eu lieu.
      // L'appelant doit le signaler — un « Enregistré » serait un mensonge.
      return false;
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
