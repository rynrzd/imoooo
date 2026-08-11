# Photographies de la vitrine

| Fichier                | Dimensions  | Poids  | Origine                                                        |
| ---------------------- | ----------- | ------ | -------------------------------------------------------------- |
| `hero-appartement.jpg` | 1536 × 1024 | 118 Ko | Image fournie par Nireo, encodée en JPEG progressif (qualité 82) |

Unique visuel de la landing : le hero de la page d'accueil. Tout le reste de la
page est construit en composants web.

## Comment elle est utilisée

Le hero (`src/components/landing/hero.tsx`) pose du **vrai texte HTML** sur un
**asset séparé** : l'image ne contient jamais le titre ni les boutons. Deux
réglages seulement la pilotent :

- **le voile d'encre** — volontairement léger (0,66 → 0,05 depuis la gauche sur
  grand écran), parce que le battant sombre de la photographie fait déjà le
  travail. Le voile ne sert qu'à garantir le contraste du texte blanc ;
- **le cadrage** (`object-position`) — `55% 50%` sur mobile, `45% 50%` à partir
  de `md`. Sur mobile le recadrage est sévère (un tiers de la largeur visible) :
  55 % est le point où l'encadrement de la porte reste à gauche **et** où la
  pièce éclairée reste visible à droite. En dessous l'écran n'est plus qu'un
  battant noir, au-dessus la porte disparaît.

Ces deux réglages ont été calés en **composant le rendu réel** (photographie
recadrée + voile + texte aux bonnes tailles) avec `sharp`, faute de navigateur
dans l'environnement de développement.

## Si la photographie est remplacée

Le remplacement du fichier suffit, mais la composition impose :

- **format paysage**, 1536 px de large **minimum** (2400 px serait mieux : le
  hero est servi en `100vw`, donc sur un écran Retina la source actuelle est
  légèrement en deçà de l'idéal) ;
- **zone sombre et calme à gauche** sur environ 45 % de la largeur — c'est là
  que vient le hook ;
- **lumière et profondeur à droite** ;
- après remplacement, revérifier le contraste du titre et, si le cadrage
  diffère, ajuster les deux `object-position` de `hero.tsx`.

## Réencoder une nouvelle image

`sharp` est déjà présent (dépendance de Next). Depuis `immopilot/` :

```bash
node -e "require('sharp')('SOURCE.png').jpeg({quality:82,progressive:true,mozjpeg:true,chromaSubsampling:'4:4:4'}).toFile('public/photos/hero-appartement.jpg')"
```
