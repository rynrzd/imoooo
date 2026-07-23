import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { AdminRole, AdminUserRow } from "./types";

/**
 * Authentification administrateur — SERVEUR uniquement.
 *
 * Le rôle est TOUJOURS vérifié en base (table `admin_users`, lue avec la
 * clé secrète) : jamais de drapeau côté client, jamais de valeur en dur.
 * La table est invisible aux clients (RLS sans policy) — seul ce module
 * peut dire si un compte est administrateur.
 */

export interface AdminContext {
  user: User;
  admin: AdminUserRow;
}

/** Ligne admin active d'un utilisateur (null si le compte n'est pas admin). */
export async function findAdminByUserId(userId: string): Promise<AdminUserRow | null> {
  if (!isAdminConfigured) return null;
  const { data, error } = await createAdminClient()
    .from("admin_users")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Lecture des administrateurs impossible : ${error.message}`);
  return (data as AdminUserRow | null) ?? null;
}

/** true si le compte est un administrateur actif. Jamais bloquant. */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    return (await findAdminByUserId(userId)) !== null;
  } catch {
    // En cas de doute (erreur réseau/config), on refuse l'accès admin.
    return false;
  }
}

/** Contexte admin de la session courante (null si non connecté ou non admin). */
export async function getAdminContext(): Promise<AdminContext | null> {
  if (!isSupabaseConfigured || !isAdminConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;
  const admin = await findAdminByUserId(user.id).catch(() => null);
  return admin ? { user, admin } : null;
}

/**
 * Guard des PAGES /admin : session admin active exigée.
 * - Aucune session → /admin/login.
 * - Session d'un utilisateur NON admin → renvoyé vers son dashboard client
 *   (jamais vers /admin/login : le proxy y redirigerait les connectés vers
 *   /admin, ce qui créerait une boucle de redirections).
 */
export async function requireAdminPage(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (ctx) return ctx;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !user.is_anonymous) redirect("/");
  }
  redirect("/admin/login");
}

/**
 * Guard des Server Actions / routes API admin : lève une erreur au lieu de
 * rediriger. Le rôle `owner` a tous les droits.
 */
export async function requireAdminAction(roles?: AdminRole[]): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Accès administrateur requis. Reconnectez-vous.");
  if (roles && ctx.admin.role !== "owner" && !roles.includes(ctx.admin.role)) {
    throw new Error("Droits insuffisants pour cette action.");
  }
  return ctx;
}
