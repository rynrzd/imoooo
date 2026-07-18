# Rapport optimisation & sécurité — ImmoPilot (17/07/2026)

## Mesures réelles (aucun chiffre inventé)
- Build production : ~60–97 s selon la passe, 38 pages, 0 erreur (mesuré 4×).
- Test de volume (scripts/volume-test.mjs, vrai Supabase, compte jetable supprimé) :
  100 logements, 300 locataires/baux, 1 000 paiements, 500 dépenses, 300 travaux,
  500 documents, 300 photos → chargement complet applicatif (8 requêtes parallèles,
  3 000 lignes) : **515 ms à froid, 283 ms à chaud**. Seed : 3,9 s.
- Sécurité multi-utilisateurs (scripts/rls-test.mjs) : **13/13 PASS** (lecture/écriture/
  suppression croisées bloquées, owner_id falsifié bloqué, plan et subscriptions
  inviolables, Storage privé, quota Free appliqué par trigger).
- E2E métier (scripts/beta-e2e-test.mjs) : **15/15 PASS** (cycle complet + zéro orphelin).

## Corrections de cette passe
- Migration `20260720090000_perf_indexes.sql` (À EXÉCUTER dans Supabase) : 3 index partiels —
  expenses(maintenance_record_id), notifications non lues, rent_payments en retard.
- Rate limit ajouté sur la suppression de compte (3 tentatives/min) ; déjà présent sur
  contact, waitlist Fondateur, relance manuelle, e-mail test ; cron protégé par CRON_SECRET.
- DEPLOYMENT.md corrigé : apply_all.sql ne couvre que les 3 premières migrations.
- backups/ ignoré par Git ; script d'export `scripts/export-backup.mjs` créé et exécuté
  avec succès (16 tables + inventaire des 5 buckets, aucun secret en sortie).
- BACKUP_AND_RECOVERY.md et MONITORING_SETUP.md créés.

## Vérifié sans modification nécessaire
- RLS activée sur les 16 tables ; policies select/insert/update/delete « own » complètes ;
  colonne plan + subscriptions + founder_purchases en écriture serveur uniquement.
- Requêtes : colonnes explicites partout dans fetchAppData (aucun select("*") en liste),
  7 requêtes parallélisées, URLs signées générées en un seul appel batch.
- Aucun console.log ; erreurs via logger.ts (point de branchement Sentry unique).
- Aucun secret NEXT_PUBLIC_, .env.local ignoré, aucune clé en Git.
- Uploads : MIME + 20 Mo + noms UUID + chemins {userId}/… ; suppression compte :
  Stripe → Storage → Auth (ordre sûr), rollback propre en cas d'échec.
- Calculs financiers centralisés dans lib/finance.ts (mêmes fonctions Dashboard et
  Statistiques — pas de double implémentation) ; graphiques en imports dynamiques.
- Headers sécurité (nosniff, referrer, frame DENY, permissions) présents.

## Limites assumées (P2 — non bloquantes pour la bêta)
- Pagination : réelle côté interface (24–XX éléments/page) mais les données du compte
  sont chargées en une fois dans le store (validé fluide jusqu'à ~3 000 lignes) —
  pagination serveur = refactoring majeur, à envisager après la bêta si besoin.
- Rate limiting en mémoire : best-effort par instance serverless (suffisant en bêta).
- Quota de stockage Mo/Go : politique affichée, non imposée techniquement (les quotas
  en nombre de fichiers, eux, sont des triggers serveur).
- Journal d'activité : activité récente en interface + email_logs en base ; pas de table
  d'audit serveur exhaustive (à créer avec l'administration future).
- Sauvegardes automatiques : dépendent du plan Supabase (Free = aucune) — voir
  BACKUP_AND_RECOVERY.md, passage au plan Pro recommandé avant production.

## État final
P0 : 0 · P1 : 0 · TypeScript : OK · ESLint : 0 erreur (2 warnings React Compiler
pré-existants) · Build : OK · Action manuelle : exécuter la migration perf_indexes
dans le SQL Editor Supabase.
