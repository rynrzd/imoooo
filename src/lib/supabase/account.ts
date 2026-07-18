import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "./config";
import { getSignedUrl, removeFile, uploadPrivateFile } from "./storage";

/**
 * Opérations « compte » (profil étendu, préférences de notifications,
 * e-mail, mot de passe, avatar). Toutes passent par Supabase Auth ou par
 * des tables protégées par RLS — aucun succès n'est simulé.
 */

/* ---------- Préférences de notifications ---------- */

/** Types de notifications (colonnes e-mail + colonnes _app pour l'in-app). */
export type NotificationKey =
  | "rent_late"
  | "payment_received"
  | "lease_expiring"
  | "document_expiring"
  | "maintenance_overdue"
  | "monthly_report"
  | "product_updates";

export type RentReminderMode = "notification" | "email_owner" | "email_tenant";

export interface NotificationPreferences {
  // Canal e-mail.
  rent_late: boolean;
  payment_received: boolean;
  lease_expiring: boolean;
  document_expiring: boolean;
  maintenance_overdue: boolean;
  monthly_report: boolean;
  product_updates: boolean;
  // Canal in-app (centre de notifications).
  rent_late_app: boolean;
  payment_received_app: boolean;
  lease_expiring_app: boolean;
  document_expiring_app: boolean;
  maintenance_overdue_app: boolean;
  monthly_report_app: boolean;
  product_updates_app: boolean;
  // Rappels de loyers impayés (configurables).
  rent_reminder_mode: RentReminderMode;
  rent_reminder_days: number[];
  rent_reminder_copy_owner: boolean;
  rent_reminder_custom_message: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  rent_late: true,
  payment_received: true,
  lease_expiring: true,
  document_expiring: true,
  maintenance_overdue: false,
  monthly_report: false,
  product_updates: false,
  rent_late_app: true,
  payment_received_app: true,
  lease_expiring_app: true,
  document_expiring_app: true,
  maintenance_overdue_app: true,
  monthly_report_app: false,
  product_updates_app: false,
  rent_reminder_mode: "notification",
  rent_reminder_days: [3, 7, 15],
  rent_reminder_copy_owner: true,
  rent_reminder_custom_message: null,
};

const PREF_COLUMNS =
  "rent_late, payment_received, lease_expiring, document_expiring, maintenance_overdue, monthly_report, product_updates, " +
  "rent_late_app, payment_received_app, lease_expiring_app, document_expiring_app, maintenance_overdue_app, monthly_report_app, product_updates_app, " +
  "rent_reminder_mode, rent_reminder_days, rent_reminder_copy_owner, rent_reminder_custom_message";

export async function fetchNotificationPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(PREF_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture des préférences impossible : ${error.message}`);
  return data
    ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data as Partial<NotificationPreferences>) }
    : DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function saveNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...preferences }, { onConflict: "user_id" });
  if (error) throw new Error(`Enregistrement des préférences impossible : ${error.message}`);
}

/* ---------- E-mail et mot de passe ---------- */

/** Vérifie le mot de passe actuel (réauthentification réelle). */
export async function verifyCurrentPassword(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Change l'adresse e-mail via Supabase Auth (jamais la table profiles
 * directement) : des e-mails de confirmation sont envoyés — l'adresse ne
 * change réellement qu'après confirmation.
 */
export async function requestEmailChange(
  supabase: SupabaseClient,
  newEmail: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    // NEXT_PUBLIC_SITE_URL : les liens des e-mails pointent toujours vers
    // l'URL canonique du site (obligatoire en production).
    { emailRedirectTo: `${SITE_URL}/auth/callback?next=/parametres` }
  );
  if (error) {
    throw new Error(
      error.code === "email_exists"
        ? "Cette adresse e-mail est déjà utilisée par un autre compte."
        : error.message
    );
  }
}

/** Change le mot de passe. Les autres sessions restent actives (comportement Supabase). */
export async function updatePassword(
  supabase: SupabaseClient,
  newPassword: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/* ---------- Avatar (bucket privé profile-avatars) ---------- */

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  previousPath: string | null
): Promise<{ path: string; signedUrl: string }> {
  const uploaded = await uploadPrivateFile(supabase, "profile-avatars", userId, "avatar", file);
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: uploaded.path })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  if (previousPath) {
    await removeFile(supabase, "profile-avatars", previousPath).catch(() => undefined);
  }
  const signedUrl = await getSignedUrl(supabase, "profile-avatars", uploaded.path);
  return { path: uploaded.path, signedUrl };
}

export async function deleteAvatar(
  supabase: SupabaseClient,
  userId: string,
  path: string
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw new Error(error.message);
  await removeFile(supabase, "profile-avatars", path).catch(() => undefined);
}

export async function getAvatarUrl(
  supabase: SupabaseClient,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  try {
    return await getSignedUrl(supabase, "profile-avatars", path);
  } catch {
    return null;
  }
}
