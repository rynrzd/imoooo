"use client";

import { Brand } from "./brand";
import { GlobalSearch } from "./global-search";
import { NotificationCenter } from "./notification-center";
import { ProfileButton } from "./profile-button";

/**
 * Header mobile — la marque, la recherche, les notifications, le profil.
 *
 * Exactement ce que montre la maquette : le vrai logo Nireo et son nom à
 * gauche, la loupe et la pastille du compte à droite. La recherche est
 * affichée parce qu'elle FONCTIONNE réellement (`global-search` interroge les
 * données déjà chargées : logements, locataires, baux, loyers, documents,
 * travaux) — ce n'est pas un bouton décoratif.
 *
 * La navigation, elle, vit dans la barre inférieure et sa feuille « Plus ».
 */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur lg:hidden">
      <Brand />
      {/* Cibles de 44 px : les boutons icône du design system font 32 px. */}
      <div className="flex items-center gap-0.5 [&>button]:size-11">
        <GlobalSearch variant="icon" />
        <NotificationCenter />
        <ProfileButton />
      </div>
    </header>
  );
}
