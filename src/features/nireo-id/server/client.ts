import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Accès base de données de Nireo ID — SERVEUR uniquement.
 *
 * Deux clients, deux usages :
 *  • `nidUserClient()` : session de l'utilisateur. La RLS fait le travail
 *    (un utilisateur ne lit que SES Téléphones). C'est le client par
 *    défaut pour toutes les lectures du propriétaire.
 *  • `nidService()` : clé secrète. Réservé aux chemins où l'appelant n'est
 *    pas (ou pas encore) le propriétaire : aperçu public, lien de partage,
 *    accès professionnel, transfert, administration. Chaque appel est
 *    précédé d'une vérification explicite des droits côté serveur.
 *
 * La clé secrète ne quitte jamais le serveur : ce module n'est jamais
 * importé par un composant client.
 */

export const isNireoIdConfigured = isSupabaseConfigured && isAdminConfigured;

/** Message unique lorsqu'une dépendance d'infrastructure manque. */
export const NID_UNAVAILABLE =
  "Nireo ID n'est pas disponible : la configuration Supabase du serveur est incomplète.";

/** Message affiché tant que la migration Nireo ID n'a pas été appliquée. */
export const NID_SCHEMA_MISSING =
  "Nireo ID n'est pas encore initialisé en base de données. Appliquez la migration " +
  "supabase/migrations/20260808090000_nireo_id.sql, puis réessayez.";

export function nidService(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("nidService() est réservé au serveur.");
  }
  if (!isNireoIdConfigured) throw new Error(NID_UNAVAILABLE);
  return createAdminClient();
}

/** Client porteur de la session utilisateur (RLS active). */
export async function nidUserClient(): Promise<SupabaseClient> {
  return createClient();
}

/** true si l'erreur signifie « la table/fonction n'existe pas encore ». */
export function isSchemaMissing(error: PostgrestError | { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = "code" in error ? error.code : undefined;
  if (code === "42P01" || code === "42883" || code === "PGRST202" || code === "PGRST205") {
    return true;
  }
  const message = error.message ?? "";
  return /does not exist|schema cache/i.test(message) && /nid_/i.test(message);
}

/**
 * Traduit une erreur base de données en message utilisateur.
 * Ne renvoie JAMAIS le détail technique brut au navigateur.
 */
export function dbErrorMessage(
  error: PostgrestError | { code?: string; message?: string } | null,
  fallback: string
): string {
  if (isSchemaMissing(error)) return NID_SCHEMA_MISSING;
  const message = error?.message ?? "";
  if (message.includes("SERIAL_ALREADY_REGISTERED")) {
    return (
      "Un téléphone actif existe déjà avec ce numéro de série. " +
      "Si cet appareil est le vôtre, demandez son transfert à son détenteur actuel."
    );
  }
  if (message.includes("IMEI_ALREADY_REGISTERED")) {
    return (
      "Un téléphone actif existe déjà avec cet IMEI. " +
      "Si cet appareil est le vôtre, demandez son transfert à son détenteur actuel."
    );
  }
  if (message.includes("QUOTA_REACHED")) {
    const max = message.match(/QUOTA_REACHED:(\d+)/)?.[1];
    return max
      ? `Votre offre Nireo ID est limitée à ${max} téléphones actifs. ` +
          "Changez d'offre ou archivez un téléphone pour en ajouter un autre."
      : "Le nombre de téléphones autorisé par votre offre Nireo ID est atteint.";
  }
  if (message.includes("WORKSPACE_FORBIDDEN")) {
    return "Votre rôle dans cet espace ne permet pas d'ajouter un téléphone.";
  }
  if (message.includes("nid_assignments_one_active")) {
    return "Ce téléphone est déjà affecté à une personne dans cet espace.";
  }
  if (message.includes("nid_check_requests_dedupe")) {
    return "Un bilan est déjà en cours pour ce téléphone à cette échéance.";
  }
  if (message.includes("nid_transfers_one_active")) {
    return "Un transfert est déjà en cours pour ce téléphone.";
  }
  if (message.includes("nid_pro_access_one_live")) {
    return "Une demande d'accès est déjà en cours pour ce téléphone.";
  }
  return fallback;
}
