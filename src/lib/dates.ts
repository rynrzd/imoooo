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

/**
 * Jours de retard d'un loyer, comptés depuis la fin du mois qu'il couvre.
 *
 * Un loyer du mois M est encaissable pendant TOUT le mois M : il n'est en
 * retard qu'à partir du 1er de M+1. C'est exactement la règle qu'applique
 * `ensureRentPayments` pour basculer une échéance en `retard`.
 *
 * L'ancien calcul partait du 1er de M. Une échéance qui venait de passer en
 * retard affichait donc déjà 28 à 31 jours, et les jalons de relance
 * J+3 / J+7 / J+15 du cron n'étaient JAMAIS atteignables : aucune relance
 * automatique ne pouvait partir. Une seule origine, ici, pour les deux
 * routes de relance et pour le texte des e-mails.
 *
 * Calculé de minuit local à minuit local : un changement d'heure ne décale
 * pas le compte d'un jour.
 */
export function rentDaysLate(monthKey: string, now: Date = new Date()): number {
  const [y, m] = monthKey.slice(0, 7).split("-").map(Number);
  // `new Date(y, m, 1)` = 1er du mois SUIVANT (les mois sont indexés à 0).
  const dueFrom = new Date(y, m, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - dueFrom.getTime()) / 86_400_000));
}
