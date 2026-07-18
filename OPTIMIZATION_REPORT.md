# Rapport d'optimisation — passe 2 (2026-07-17)

Méthode : mesures réelles sur le build de production (taille des scripts
référencés par le HTML initial de chaque route, non compressés). Aucune
valeur inventée ; « non mesurable » est indiqué quand c'est le cas.

## Mesures
| Route | JS initial avant | après | build |
|---|---|---|---|
| / (dashboard) | 1 684 Ko | 1 684 Ko | 78 s |
| /logements | 1 695 Ko | 1 695 Ko | |
| /statistiques | 1 237 Ko | 1 237 Ko | |
| /documents | 1 603 Ko | 1 603 Ko | |
| /photos | 1 616 Ko | 1 617 Ko | |
| /loyers | 1 602 Ko | 1 602 Ko | |

(Rappel passe 1 : recharts ~355 Ko sorti du JS initial — vérifié absent du
HTML initial de / et /statistiques.)

## Problème critique corrigé (non mesurable en Ko côté build)
- **Photos non optimisées** : `needsUnoptimized()` marquait toutes les URLs
  Supabase `unoptimized` → les grilles chargeaient les **originaux pleine
  taille**. Corrigé : les URLs `*.supabase.co` passent par l'optimiseur
  Next (redimensionnement + WebP/AVIF selon `sizes`). Gain réel en bande
  passante proportionnel à la taille des photos — mesurable uniquement en
  runtime avec de vraies images.

## Autres corrections de cette passe
- Pagination ajoutée : **Travaux** (20/chantiers) et **Dépenses du dossier
  logement** (20/page) — totaux calculés sur la liste complète.
- Déjà en place (passe 1) : loyers 24/p, documents 25/p, photos 24/p.

## Constats d'audit (sans action, justifié)
- JS initial ~1,6 Mo/route : dominé par le shell client (store applicatif,
  base-ui, framework). Le réduire exige de sortir le store du layout —
  refonte d'architecture exclue par la mission.
- Requêtes : 8 lectures ciblées (colonnes explicites) + 2 écritures
  idempotentes par chargement de session ; mutations = mise à jour locale,
  pas de refetch global. URLs signées : 1 batch photos + à la demande.
- Recherches/filtres : store local → zéro requête par frappe (debounce inutile).
- Index DB : couverture complète (owner_id, property_id, tenant_id, lease_id,
  month desc, date desc, status, expiry) — aucun index manquant identifié,
  pas de nouvelle migration.
- Calculs financiers : centralisés dans finance.ts/insights.ts, gardes
  NaN/division-par-zéro en place (vérifié passes précédentes).
- Test de charge (100 logements/1 000 paiements) : non exécutable sans compte
  confirmé — `scripts/seed-dev.mjs` prêt (jamais en production).

## Gates
TypeScript 0 erreur · Lint 0 erreur (2 warnings React-Compiler bénins) ·
Build OK 31 routes (78 s).

## Prochaine action exacte
Confirmer un compte test, exécuter `seed-dev.mjs`, vérifier en navigateur :
poids réseau des grilles photos (doit être réduit), pagination travaux/dépenses.
