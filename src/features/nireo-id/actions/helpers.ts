import type { z } from "zod";
import { logger } from "@/lib/logger";
import type { ActionResult } from "../types";

/**
 * Utilitaires des Server Actions Nireo ID.
 *
 * Une action ne renvoie JAMAIS un succès non confirmé par le serveur, et
 * jamais un message technique brut : les erreurs inattendues sont
 * journalisées côté serveur et traduites en français pour l'utilisateur.
 */

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data: data as T };
}

export function fail(error: string, field?: string): ActionResult<never> {
  return { ok: false, error, field };
}

/** Valide une entrée avec Zod et renvoie le premier message d'erreur utile. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  raw: unknown
): { ok: true; value: z.infer<S> } | { ok: false; error: string; field?: string } {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  return {
    ok: false,
    error: issue?.message ?? "Données invalides.",
    field: issue?.path?.[0] !== undefined ? String(issue.path[0]) : undefined,
  };
}

/** Enveloppe commune : journalise, puis renvoie un message compréhensible. */
export async function run<T>(
  scope: string,
  handler: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await handler();
  } catch (error) {
    logger.error(`nireo-id/${scope}`, error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Une erreur est survenue. Réessayez dans un instant.";
    return { ok: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Lecture de FormData                                                */
/* ------------------------------------------------------------------ */

export function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function bool(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === "true" || value === "on" || value === "1";
}

/** Nombre optionnel : champ vide = null (jamais 0 par accident). */
export function numberOrNull(form: FormData, key: string): number | null {
  const raw = text(form, key).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function file(form: FormData, key: string): File | null {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export function files(form: FormData, key: string): File[] {
  return form
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function list(form: FormData, key: string): string[] {
  return form.getAll(key).filter((value): value is string => typeof value === "string" && value !== "");
}
