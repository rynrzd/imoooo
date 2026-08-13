import type { PropertyType } from "./types";

/** Types de bien proposés — identiques partout (création, édition, filtres). */
export const PROPERTY_TYPES: PropertyType[] = [
  "Studio",
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "Maison",
];

/**
 * Nombre de pièces déduit du type. Ce n'est pas une invention : « T3 » veut
 * dire trois pièces. Seule la maison, qui n'encode rien, doit être demandée.
 *
 * La colonne `rooms` est `not null check (rooms >= 1)` en base : sans cette
 * déduction, il faudrait poser une question dont l'utilisateur connaît déjà la
 * réponse — ou risquer une insertion refusée.
 */
export const ROOMS_BY_TYPE: Record<PropertyType, number | null> = {
  Studio: 1,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
  Maison: null,
};

/** true si le type n'encode pas le nombre de pièces (il faut le demander). */
export function needsRoomCount(type: PropertyType): boolean {
  return ROOMS_BY_TYPE[type] === null;
}

/**
 * Convertit une saisie française en nombre : « 1 234,50 » → 1234.5.
 * Renvoie null si la saisie n'est pas un nombre exploitable — l'appelant
 * décide alors du message, il n'y a jamais de NaN qui file jusqu'à la base.
 */
export function parseAmount(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
