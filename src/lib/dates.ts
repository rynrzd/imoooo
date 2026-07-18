/**
 * Helpers de manipulation de mois au format "yyyy-mm".
 * Les données de démonstration sont ancrées sur le mois courant,
 * afin que l'application reste cohérente quelle que soit la date d'ouverture.
 */

export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

export function monthKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Décale un mois "yyyy-mm" de n mois (n peut être négatif). */
export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return monthKeyOf(date);
}

/** Liste ordonnée de mois entre deux bornes incluses. */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/** Les n derniers mois, du plus ancien au plus récent (mois courant inclus). */
export function lastMonths(n: number): string[] {
  const current = currentMonthKey();
  return monthRange(addMonths(current, -(n - 1)), current);
}

/** Date ISO (yyyy-mm-dd) pour un mois donné et un jour donné. */
export function isoDate(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

/** Dernier jour d'un mois "yyyy-mm" au format ISO. */
export function endOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return isoDate(monthKey, lastDay);
}

export function yearOf(monthKey: string): number {
  return Number(monthKey.slice(0, 4));
}

/** Nombre de mois écoulés entre une date ISO et aujourd'hui (ou une date de fin). */
export function monthsBetween(fromISO: string, toISO?: string | null): number {
  const from = new Date(`${fromISO}T12:00:00`);
  const to = toISO ? new Date(`${toISO}T12:00:00`) : new Date();
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  );
}

export function todayISO(): string {
  const now = new Date();
  return isoDate(monthKeyOf(now), now.getDate());
}
