/**
 * Landing Intelligence — fenêtres d'analyse.
 *
 * Module PUR (aucune dépendance serveur) : il est importé aussi bien par les
 * lectures Supabase que par l'interface d'administration, sans jamais faire
 * entrer de code serveur dans le bundle du navigateur.
 */

export const LANDING_RANGES = ["24h", "7d", "30d", "90d"] as const;

export type LandingRange = (typeof LANDING_RANGES)[number];

export function isLandingRange(value: unknown): value is LandingRange {
  return typeof value === "string" && (LANDING_RANGES as readonly string[]).includes(value);
}

/** Fenêtre temporelle et granularité associées à une plage. */
export function rangeWindow(range: LandingRange): { bucket: "hour" | "day"; since: Date } {
  const since = new Date();
  switch (range) {
    case "24h":
      since.setUTCHours(since.getUTCHours() - 23);
      return { bucket: "hour", since };
    case "7d":
      since.setUTCDate(since.getUTCDate() - 6);
      return { bucket: "day", since };
    case "30d":
      since.setUTCDate(since.getUTCDate() - 29);
      return { bucket: "day", since };
    case "90d":
      since.setUTCDate(since.getUTCDate() - 89);
      return { bucket: "day", since };
  }
}
