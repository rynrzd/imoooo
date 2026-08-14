/**
 * Le monogramme Nireo en CONTOUR — source unique.
 *
 * C'est le même « N » que celui de la marque (`NireoMark`), redessiné en un
 * seul tracé fermé pour pouvoir être *dessiné* : `pathLength="100"` permet
 * d'animer `stroke-dashoffset` de 100 à 0 sans jamais recalculer la longueur
 * réelle du chemin, quelle que soit la taille d'affichage.
 *
 * Deux endroits l'utilisent, et deux seulement : le fond du menu plein écran
 * et l'appel à l'action final. La landing elle-même n'en porte aucun autre —
 * le grand symbole reste un signe rare.
 */

export const N_OUTLINE_PATH = "M0 240 V0 H44 L156 168 V0 H200 V240 H156 L44 72 V240 Z";

export const N_OUTLINE_VIEWBOX = "0 0 200 240";

export function NireoOutline({
  className,
  stroke = "currentColor",
  strokeWidth = 1,
  pathClassName,
  draw = false,
}: {
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Porte l'animation de tracé du menu (`.nl-menu-n-path`, globals.css). */
  pathClassName?: string;
  /**
   * Confie le tracé à l'observateur unique de la landing : le contour se
   * dessine quand il entre à l'écran, une seule fois, et n'est jamais masqué
   * sans JavaScript ni en mouvement réduit.
   */
  draw?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={N_OUTLINE_VIEWBOX}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <path
        className={pathClassName}
        d={N_OUTLINE_PATH}
        // `pathLength` normalise la longueur du tracé à 100 : l'animation ne
        // dépend donc ni de la géométrie ni de la taille d'affichage.
        pathLength={100}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        {...(draw ? { "data-draw": "", style: { ["--nl-len" as string]: 100 } } : null)}
      />
    </svg>
  );
}
