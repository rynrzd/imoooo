# Landing Intelligence

Moteur de personnalisation, d'expérimentation et d'optimisation continue de la
vitrine Nireo. Objectif : **la landing s'améliore d'elle-même à partir du
comportement réel des visiteurs**, sans jamais dégrader l'expérience, la marque,
les performances ou le SEO.

> Principe non négociable : l'IA ne rédige rien et ne modifie jamais la page
> librement. Elle **analyse**, **propose** et **sélectionne** parmi des variantes
> écrites et validées à la main dans `src/lib/landing/catalog.ts`.

---

## 1. Mise en service

1. Exécuter la migration `supabase/migrations/20260801090000_landing_intelligence.sql`
   dans le SQL Editor Supabase (idempotente).
2. Vérifier que `SUPABASE_SECRET_KEY` et `CRON_SECRET` sont présents dans
   l'environnement (Vercel → Settings → Environment Variables).
3. La tâche planifiée `/api/cron/landing-optimizer` (déclarée dans `vercel.json`,
   tous les jours à 4 h) réalise le cycle d'apprentissage.

Tant que la migration n'est pas appliquée : la vitrine sert sa **version de
référence** (le contenu d'origine), rien n'est cassé, rien n'est mesuré, et
`/admin/landing` affiche un message explicite.

---

## 2. Architecture

```
src/lib/landing/
  types.ts            Types du moteur (slots, segments, config, événements)
  catalog.ts          CATALOGUE des variantes validées  ← le garde-fou
  audience.ts         Détection du profil visiteur (fonctions pures)
  assign.ts           Assignation déterministe + plancher d'exploration
  resolve.ts          (profil + config + catalogue) → contenu à rendre
  config.ts           Configuration active + cache mémoire 60 s
  server.ts           Profil de la requête, écriture des événements, conversions
  scoring.ts          Statistiques bayésiennes, scores /10, Thompson sampling
  recommendations.ts  Moteur de recommandations explicables
  patch.ts            Modifications applicables (validées) + description FR
  engine.ts           Publication de version + pilote automatique
  actions.ts          Server Actions d'administration (rôle vérifié en base)
  queries.ts          Lectures pour le tableau de bord
  ranges.ts           Fenêtres d'analyse (module pur, partagé avec le client)
```

Le moteur est **réutilisable sur d'autres pages** : il suffit de déclarer de
nouveaux slots dans le catalogue et de résoudre la page via
`getLandingResolution()`.

### Flux d'une visite

1. **`src/proxy.ts`** pose deux cookies HttpOnly avant tout rendu :
   `nireo_vid` (UUID aléatoire) et `nireo_vst` (nombre de visites + source).
2. **`getLandingResolution()`** (rendu serveur) construit le profil, lit la
   configuration en cache et résout chaque slot :
   1. variante épinglée par l'administration ;
   2. règle de personnalisation du segment (sauf groupe témoin) ;
   3. tirage pondéré déterministe.
3. La page arrive **déjà personnalisée** : pas de rechargement, pas de
   scintillement, pas de script bloquant, Core Web Vitals intacts.
4. **`LandingTracker`** mesure le comportement et envoie des lots d'événements à
   `/api/landing/collect`, qui **recalcule** la combinaison servie côté serveur
   (le navigateur ne peut donc pas mentir sur ce qu'il a vu).

---

## 3. Ce qui est mesuré

| Catégorie | Détail |
| --- | --- |
| Exposition | combinaison de variantes servie, version de configuration |
| Engagement | scroll ≥ 25 % ou ≥ 10 s, temps total, profondeur atteinte |
| Sections | entrée dans le viewport, temps passé, dernière section vue |
| Clics | position **relative** (heatmap), élément instrumenté `data-lx` |
| Vidéo | lecture, progression 25/50/75/95 % |
| Tunnel | inscription démarrée, abonnement choisi, compte créé, paiement |
| Contexte | segment, source, appareil, pays, langue, visiteur déjà venu |

**Les conversions ne sont jamais déclarées par le navigateur** :

- `signup_completed` est écrit par `(app)/layout.tsx` à partir d'une session
  Supabase vérifiée (index unique en base → jamais de double comptage) ;
- `payment_started` vient de la route de checkout Stripe ;
- `payment_success` vient du **webhook Stripe signé**.

### RGPD

Aucune donnée personnelle. L'identifiant visiteur est aléatoire (jamais dérivé
de l'IP ni d'un compte), les coordonnées de clic sont relatives, aucun contenu
de formulaire n'est collecté, aucun cookie tiers n'est posé. Les robots ne sont
ni identifiés, ni mesurés, ni personnalisés. Rétention des événements bruts :
180 jours (`landing_prune_events`).

---

## 4. Méthode statistique

- Chaque variante est une suite d'essais de Bernoulli (la session a converti ou
  non). Le taux est estimé par une loi **Beta** (`a = succès + 1`).
- **Objectif optimisé** : la conversion la plus profonde disposant d'assez de
  signal — paiements → comptes créés → clics CTA → sessions engagées. L'objectif
  courant est affiché dans l'administration.
- **Score /10** : taux « rétréci » vers la moyenne du slot (Bayes empirique,
  poids de a priori = 20), rapporté à la meilleure variante **disposant de
  données**. Sous 30 sessions, aucun score n'est publié : l'interface affiche
  « données insuffisantes ».
- **Répartition du trafic** : échantillonnage de Thompson (probabilité d'être
  réellement la meilleure), déterministe pour un même jeu de données. Un
  **plancher d'exploration** (8 % par défaut) garantit qu'aucune variante n'est
  jamais complètement arrêtée : le moteur continue d'apprendre en permanence.
- **Groupe témoin** : 15 % des sessions ignorent volontairement les règles de
  personnalisation. Sans ce témoin, il serait impossible de savoir si la
  personnalisation apporte réellement quelque chose
  (`landing_personalization_effect`).

---

## 5. Recommandations

Générées par `analyse()` (fonction pure) à partir des 30 derniers jours. Chaque
recommandation porte un **pourquoi chiffré**, un **impact estimé**, une
**confiance statistique** et un **patch applicable en un clic** :

| Type | Déclenchement | Patch proposé |
| --- | --- | --- |
| `variant_winner` | une variante devance les autres (p ≥ 90 %, ≥ 30 sessions) | augmenter sa part de trafic |
| `segment_rule` | un segment réagit mieux à une variante (p ≥ 85 %) | créer une règle de personnalisation |
| `section_reorder` | ≥ 30 % de sorties sans clic sur une section | tester un nouvel ordre sur 40 % du trafic |
| `device_rule` | scroll mobile < 75 % du scroll ordinateur | ordre « démonstration d'abord » sur mobile |
| `personalization` | comparaison au groupe témoin | informatif |
| `content` | vidéo ou témoignages manquants | informatif |
| `engagement` | rebond ≥ 60 % | remonter la démonstration |

Les patchs ne peuvent **que** déplacer du trafic, épingler une variante du
catalogue, ajouter une règle, ou proposer une **permutation validée** des
sections. Ils ne peuvent ni créer de texte, ni supprimer une section, ni toucher
aux métadonnées SEO.

---

## 6. Versions et retour arrière

Chaque changement (manuel, recommandation, pilote automatique, composition,
retour arrière) crée une ligne dans `landing_versions` avec son motif. Le retour
arrière **republie** l'ancienne configuration sous un nouveau numéro : rien
n'est jamais effacé de l'historique.

---

## 7. Ajouter une variante

1. Ajouter un objet dans le tableau `variants` du slot concerné
   (`src/lib/landing/catalog.ts`) — clé, libellé, description, contenu.
2. C'est tout. Elle entre immédiatement dans l'expérimentation avec un poids par
   défaut, sans migration ni changement de schéma.

Pour un contenu qui dépend d'un média (vidéo, témoignages), renseigner
`requires` : la variante est automatiquement **retirée** de l'expérimentation
tant que le contenu réel n'existe pas — jamais de bloc vide, jamais de faux
contenu.

Pour ajouter un **slot** : étendre `SLOT_KEYS`, `SlotPayloadMap` et
`LANDING_SLOTS`, puis consommer `content.<slot>` dans la page.

---

## 8. SEO et performances

- Les robots (`isCrawler`) reçoivent toujours la **version de référence** :
  contenu canonique stable, `<h1>` unique, métadonnées inchangées.
- La résolution est **synchrone et sans I/O** (assignation par hachage) ; la
  configuration est en cache mémoire 60 s → 2 requêtes SQL par minute et par
  instance, quel que soit le trafic.
- Le suivi est non bloquant, groupé, et utilise `sendBeacon` en fin de visite.
- Aucune dépendance ajoutée au projet.
