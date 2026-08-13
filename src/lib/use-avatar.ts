"use client";

import * as React from "react";
import { getAvatarUrl } from "./supabase/account";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { useAppStore } from "./store";

/**
 * Photo de profil de l'utilisateur connecté, et ses initiales de repli.
 *
 * Le bucket `profile-avatars` est PRIVÉ : l'image n'est jamais servie par une
 * URL publique, seulement par une URL signée d'une heure, demandée ici. Tant
 * qu'elle n'est pas revenue — ou si le compte n'a pas de photo — on affiche
 * l'initiale, jamais une silhouette générique.
 */
export function useAvatar(): { url: string | null; initials: string } {
  const { profile } = useAppStore();
  const avatarPath = profile?.avatarPath ?? null;
  const [url, setUrl] = React.useState<string | null>(null);

  // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (!isSupabaseConfigured || !avatarPath) {
        setUrl(null);
        return;
      }
      void getAvatarUrl(createClient(), avatarPath).then((signed) => {
        if (!cancelled) setUrl(signed);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [avatarPath]);

  return { url, initials: initialsOf(profile?.fullName, profile?.email) };
}

/**
 * Initiales affichées dans la pastille : prénom et nom, sinon la première
 * lettre de l'e-mail.
 *
 * Renvoie une chaîne VIDE quand l'identité n'est pas encore connue (profil en
 * cours de chargement, mode démo). L'appelant affiche alors une silhouette
 * neutre : un point d'interrogation donnerait l'impression d'un compte cassé.
 */
export function initialsOf(
  fullName: string | null | undefined,
  email?: string | null
): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 0) {
    return ((parts[0][0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email ?? "").trim().charAt(0).toUpperCase();
}
