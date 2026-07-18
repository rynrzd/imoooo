/** Utilitaires de formatage centralisés (fr-FR). */

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** Format court pour les axes de graphiques (ex. "12,5 k€"). */
export function formatCurrencyCompact(amount: number): string {
  return compactCurrencyFormatter.format(amount);
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T12:00:00`));
}

/** Date longue capitalisée ("Mardi 15 juillet 2026"). */
export function formatDateLong(date: Date): string {
  const label = longDateFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Variation signée pour les tendances ("+12 %", "−8 %"). */
export function formatDelta(percent: number, digits = 0): string {
  const value = percent.toLocaleString("fr-FR", {
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  });
  return `${value} %`;
}

/** "2026-07" → "juillet 2026". */
export function formatMonth(monthKey: string): string {
  const label = monthFormatter.format(new Date(`${monthKey}-15T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-07" → "juil." (libellé d'axe). */
export function formatMonthShort(monthKey: string): string {
  return shortMonthFormatter.format(new Date(`${monthKey}-15T12:00:00`));
}

export function formatSurface(surface: number): string {
  return `${surface} m²`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;
}

/** Initiales d'une personne pour les avatars ("Camille Roux" → "CR"). */
export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
