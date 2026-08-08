import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { NidAdminRow, ProfessionalProfileRow } from "../types";
import { isNireoIdConfigured, isSchemaMissing, nidService } from "./client";

/**
 * Contrôles d'accès de Nireo ID — TOUJOURS côté serveur.
 *
 * Aucun drapeau du navigateur n'ouvre quoi que ce soit : le rôle
 * professionnel et le rôle administrateur sont relus en base à chaque
 * requête. Les rôles Nireo ID (`nid_admins`) sont indépendants de ceux de
 * Nireo Immo (`admin_users`) : aucun privilège ne traverse les produits.
 */

export interface NidSession {
  user: User;
  email: string;
}

/** Session valide (compte confirmé) ou null. */
export async function getNidSession(): Promise<NidSession | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email_confirmed_at || !user.email) return null;
  return { user, email: user.email.toLowerCase() };
}

/** Guard des pages /id/app : redirige vers la connexion partagée Nireo. */
export async function requireNidSession(nextPath: string): Promise<NidSession> {
  const session = await getNidSession();
  if (session) return session;
  redirect(`/connexion?next=${encodeURIComponent(nextPath)}`);
}

/** Guard des Server Actions : lève une erreur claire au lieu de rediriger. */
export async function requireNidUser(): Promise<NidSession> {
  const session = await getNidSession();
  if (!session) {
    throw new Error("Votre session a expiré. Reconnectez-vous pour continuer.");
  }
  return session;
}

/* ------------------------------------------------------------------ */
/*  Professionnels                                                     */
/* ------------------------------------------------------------------ */

/** Fiche professionnelle de l'utilisateur (null s'il n'en a pas déposé). */
export async function getProfessionalProfile(
  userId: string
): Promise<ProfessionalProfileRow | null> {
  if (!isNireoIdConfigured) return null;
  const { data, error } = await nidService()
    .from("nid_professional_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) return null;
    throw new Error(`Lecture du compte professionnel impossible : ${error.message}`);
  }
  return (data as ProfessionalProfileRow | null) ?? null;
}

/**
 * Professionnel APPROUVÉ uniquement. Un compte en attente, refusé ou
 * suspendu ne peut créer aucun événement « validé par un professionnel ».
 */
export async function requireApprovedProfessional(
  userId: string
): Promise<ProfessionalProfileRow> {
  const profile = await getProfessionalProfile(userId);
  if (!profile) {
    throw new Error("Aucun compte professionnel n'est rattaché à votre compte Nireo.");
  }
  if (profile.status !== "approuve") {
    throw new Error(
      "Votre compte professionnel n'est pas approuvé : vous ne pouvez pas encore enregistrer d'intervention."
    );
  }
  return profile;
}

/* ------------------------------------------------------------------ */
/*  Administration Nireo ID                                            */
/* ------------------------------------------------------------------ */

export interface NidAdminContext {
  user: User;
  admin: NidAdminRow;
}

export async function getNidAdminContext(): Promise<NidAdminContext | null> {
  if (!isNireoIdConfigured) return null;
  const session = await getNidSession();
  if (!session) return null;
  const { data, error } = await nidService()
    .from("nid_admins")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    // En cas de doute (schéma absent, erreur réseau), on refuse l'accès.
    return null;
  }
  return data ? { user: session.user, admin: data as NidAdminRow } : null;
}

/** Guard des pages /id/admin. */
export async function requireNidAdminPage(): Promise<NidAdminContext> {
  const ctx = await getNidAdminContext();
  if (ctx) return ctx;
  const session = await getNidSession();
  // Connecté mais non administrateur : retour à son espace personnel —
  // jamais vers une page de connexion (qui rebouclerait).
  if (session) redirect("/id/app");
  redirect(`/connexion?next=${encodeURIComponent("/id/admin")}`);
}

/** Guard des Server Actions d'administration. */
export async function requireNidAdminAction(): Promise<NidAdminContext> {
  const ctx = await getNidAdminContext();
  if (!ctx) throw new Error("Droits d'administration Nireo ID requis.");
  return ctx;
}
