/**
 * Types partagés de l'espace d'administration.
 * Fichier SANS code serveur : importable par les composants client
 * (les fichiers « use server » ne peuvent exporter que des fonctions).
 */

export type AdminRole = "owner" | "admin" | "support";

export interface AdminUserRow {
  id: string;
  user_id: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

/** Résultat standard des Server Actions administratives. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type ModerationStatus = "active" | "suspended" | "banned";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  support: "Support",
};

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  active: "Actif",
  suspended: "Suspendu",
  banned: "Banni",
};
