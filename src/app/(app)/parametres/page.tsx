import { permanentRedirect } from "next/navigation";

/**
 * ANCIENNE ROUTE « Paramètres » — conservée uniquement pour rediriger.
 *
 * Tout son contenu vit désormais dans Profil et ses sous-pages. La route reste
 * en place parce qu'elle circule ailleurs : favoris des utilisateurs, liens
 * d'e-mails de confirmation déjà envoyés, retour depuis Nireo ID. Elle ne doit
 * donc jamais répondre 404.
 *
 * L'ancien paramètre `?onglet=` est traduit vers la sous-page correspondante :
 * un lien vers l'aide continue d'ouvrir l'aide, pas le hub.
 */

/** Ancien onglet → nouvelle sous-page. */
const TAB_DESTINATIONS: Record<string, string> = {
  profile: "/profil/informations",
  security: "/profil/securite",
  notifications: "/profil/preferences",
  appearance: "/profil/preferences",
  subscription: "/abonnement",
  data: "/profil/donnees",
  aide: "/profil/aide",
};

export default async function SettingsRedirect({
  searchParams,
}: PageProps<"/parametres">) {
  const search = await searchParams;
  const tab = typeof search.onglet === "string" ? search.onglet : "";
  // 308 : les navigateurs et les moteurs mémorisent la nouvelle adresse.
  permanentRedirect(TAB_DESTINATIONS[tab] ?? "/profil");
}
