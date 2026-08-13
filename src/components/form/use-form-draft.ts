"use client";

import * as React from "react";

/**
 * BROUILLON DE FORMULAIRE — réellement enregistré, réellement isolé.
 *
 * Règle absolue : on n'affiche « votre progression est enregistrée » que si
 * elle l'est vraiment. Ce hook rend le brouillon fonctionnel ET renvoie
 * `ready` : tant qu'aucune écriture n'a réussi, l'appelant n'affiche rien.
 *
 * Isolation : la clé contient l'identifiant de l'utilisateur. Deux comptes sur
 * le même navigateur ne peuvent donc pas voir le brouillon l'un de l'autre, et
 * `clear()` est appelé après une création réussie — jamais de brouillon fantôme
 * qui repropose un logement déjà créé.
 *
 * Le stockage peut échouer (navigation privée Safari, quota plein) : tout est
 * enveloppé, et l'échec se traduit simplement par « pas de brouillon ».
 */

const PREFIX = "nireo:draft";

function storageKey(formKey: string, userId: string | null): string | null {
  if (!userId) return null;
  return `${PREFIX}:${userId}:${formKey}`;
}

export interface FormDraft<T> {
  /** Valeurs retrouvées au montage (null si aucun brouillon). */
  restored: T | null;
  /** true si l'écriture du brouillon fonctionne réellement sur cet appareil. */
  ready: boolean;
  save: (values: T) => void;
  clear: () => void;
}

export function useFormDraft<T>(
  formKey: string,
  userId: string | null
): FormDraft<T> {
  const key = storageKey(formKey, userId);
  const [restored, setRestored] = React.useState<T | null>(null);
  const [ready, setReady] = React.useState(false);
  // Le brouillon n'est relu qu'une fois : ensuite l'utilisateur est maître.
  const loaded = React.useRef(false);

  // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!key || loaded.current) return;
    loaded.current = true;
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) setRestored(JSON.parse(raw) as T);
        // Test d'écriture réel : sans lui on promettrait une sauvegarde qui
        // n'existe pas (navigation privée, stockage désactivé).
        const probe = `${PREFIX}:probe`;
        window.localStorage.setItem(probe, "1");
        window.localStorage.removeItem(probe);
        setReady(true);
      } catch {
        setReady(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [key]);

  const save = React.useCallback(
    (values: T) => {
      if (!key) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(values));
      } catch {
        // Quota plein : le formulaire continue de fonctionner, sans brouillon.
        setReady(false);
      }
    },
    [key]
  );

  const clear = React.useCallback(() => {
    if (!key) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Rien à faire : au pire le brouillon expire avec le navigateur.
    }
  }, [key]);

  return { restored, ready, save, clear };
}

/**
 * Enregistre `values` peu après chaque modification (anti-rafale de 400 ms).
 * `enabled` permet de suspendre l'écriture pendant la soumission finale.
 */
export function useDraftAutosave<T>(
  draft: FormDraft<T>,
  values: T,
  enabled = true
): void {
  const { save, ready } = draft;
  React.useEffect(() => {
    if (!enabled || !ready) return;
    const id = window.setTimeout(() => save(values), 400);
    return () => window.clearTimeout(id);
  }, [enabled, ready, save, values]);
}
