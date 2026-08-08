/**
 * Nireo ID — formatage des valeurs affichées (client et serveur).
 * Dates, montants et identifiants doivent être faciles à scanner.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MONEY_FORMAT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** Date d'un événement (`YYYY-MM-DD`). */
export function formatEventDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FORMAT.format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return SHORT_DATE_FORMAT.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return DATETIME_FORMAT.format(date);
}

export function formatMoneyFromCents(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  return MONEY_FORMAT.format(cents / 100);
}

/** Taille de fichier lisible (Ko / Mo). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Délai restant avant expiration, en français, sans fausse précision. */
export function formatRemaining(expiresAt: string): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remaining) || remaining <= 0) return "expiré";
  const hours = Math.floor(remaining / 3_600_000);
  if (hours < 1) return "moins d’une heure";
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 jour" : `${days} jours`;
}

/** Masque un identifiant privé : seuls les 4 derniers caractères. */
export function maskIdentifier(last4: string): string {
  return last4 ? `•••• ${last4}` : "—";
}
