"use client";

import { Brand } from "./brand";
import { GlobalSearch } from "./global-search";
import { NotificationCenter } from "./notification-center";

/**
 * Header mobile — la marque, la recherche, les notifications. Rien d'autre.
 *
 * Le menu hamburger et son panneau de treize liens ont disparu : la
 * navigation vit désormais dans la barre inférieure (`bottom-nav`), à portée
 * de pouce, et le reste dans sa feuille « Plus ». Le header ne porte plus que
 * ce qui est ponctuel.
 */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
      <Brand />
      {/* Cibles de 44 px : les boutons icône du design system font 32 px. */}
      <div className="flex items-center gap-1 [&_button]:size-11">
        <GlobalSearch variant="icon" />
        <NotificationCenter />
      </div>
    </header>
  );
}
