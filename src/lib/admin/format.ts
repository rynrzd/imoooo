/**
 * Formatage des dates de l'espace admin — accepte les timestamps ISO
 * complets (created_at, current_period_end…), contrairement à
 * `lib/format.formatDate` qui attend une date « YYYY-MM-DD ».
 * JAMAIS d'exception : une valeur absente ou invalide affiche « — ».
 */

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « 23 juil. 2026 » — ou « — » si absent/invalide. */
export function formatAdminDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE.format(date) : "—";
}

/** « 23/07/2026 16:53 » — ou « — » si absent/invalide. */
export function formatAdminDateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_TIME.format(date) : "—";
}
