# Photographies de la vitrine

| Fichier      | Source                                                                 | Licence                                              |
| ------------ | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `sejour.jpg` | Unsplash — `photo-1600210492486-724fe5c67fb0` (2400 × 1800, qualité 72) | Licence Unsplash (usage commercial libre, sans crédit) |

`sejour.jpg` est l'unique photographie du hero de la page d'accueil.

Elle est utilisée comme **asset séparé** : le titre, le sous-titre et les boutons
sont du vrai texte HTML posé par-dessus (`src/components/landing/hero.tsx`), jamais
une image contenant déjà la mise en page. Remplacer la photographie par une prise
de vue propriétaire ne demande donc qu'un remplacement de fichier, à condition de
respecter :

- un format paysage (2400 × 1800 ici) et une lumière venant de la **droite** — le
  voile sombre du hero est dégradé depuis la **gauche**, c'est lui qui garantit le
  contraste du texte blanc ;
- un poids raisonnable (≈ 650 Ko) : l'image est servie via `next/image`
  (`priority`), donc recompressée et redimensionnée à la volée.
