"use client";

import Image from "next/image";
import { Building2, ImageOff } from "lucide-react";
import { needsUnoptimized } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * EMPLACEMENT DE PHOTO D'UN LOGEMENT — le seul de l'application.
 *
 * Trois règles, appliquées ici une fois pour toutes :
 *
 *  1. `src=""` n'atteint JAMAIS `<Image>` (Next lève une erreur et la page
 *     casse) : l'absence est traitée avant le rendu, pas après.
 *  2. Aucune photo générique. Un logement sans photo montre une surface Nireo
 *     — quadrillage cobalt à peine perceptible — pas l'immeuble de quelqu'un
 *     d'autre récupéré sur une banque d'images.
 *  3. Les DIMENSIONS ne changent pas. Le conteneur porte la taille et la
 *     photo la remplit (`fill`) : présente ou absente, l'emplacement occupe
 *     exactement la même place, donc la mise en page ne saute jamais.
 *
 * `tone="deep"` sert aux emplacements sur lesquels du texte blanc est posé
 * (bannière du dossier) : le placeholder y est bleu nuit, pour que le titre
 * reste lisible sans photo.
 *
 * `missing` distingue deux absences très différentes :
 *   - le logement n'a pas de photo (cas normal) ;
 *   - la photo existe mais son URL signée n'a pas pu être obtenue (incident).
 */
export function PropertyThumb({
  src,
  alt,
  className,
  sizes = "96px",
  tone = "light",
  priority = false,
  missing = false,
  label,
}: {
  /** URL de la photo ; chaîne vide quand il n'y en a pas. */
  src: string;
  alt: string;
  /** Porte la TAILLE de l'emplacement (elle ne dépend pas de la photo). */
  className?: string;
  sizes?: string;
  tone?: "light" | "deep";
  priority?: boolean;
  /** true : la photo devrait exister mais son URL est indisponible. */
  missing?: boolean;
  /** Légende affichée sous l'icône quand l'emplacement est assez grand. */
  label?: string;
}) {
  const deep = tone === "deep";

  if (src) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={needsUnoptimized(src)}
          className="object-cover"
        />
      </span>
    );
  }

  const Icon = missing ? ImageOff : Building2;

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden",
        deep ? "nireo-photo-empty-deep" : "nireo-photo-empty",
        className
      )}
      // L'emplacement est décoratif quand il est vide : il n'apporte aucune
      // information que le nom du logement, juste à côté, ne donne déjà.
      role="presentation"
    >
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
        <Icon
          className={cn(
            "size-5",
            deep ? "text-white/45" : "text-muted-foreground/45"
          )}
          aria-hidden
        />
        {label ? (
          <span
            className={cn(
              "px-2 text-[11px] leading-tight",
              deep ? "text-white/60" : "text-muted-foreground/70"
            )}
          >
            {label}
          </span>
        ) : null}
      </span>
    </span>
  );
}
