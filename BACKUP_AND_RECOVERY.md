# Sauvegarde, restauration et continuité — ImmoPilot

## 1. Sauvegardes Supabase selon le plan
- Plan **Free** : AUCUNE sauvegarde automatique. Seule protection : les exports manuels ci-dessous.
- Plan **Pro** : sauvegardes quotidiennes automatiques (rétention 7 jours), restauration en un clic
  (Dashboard → Database → Backups). Point-in-Time Recovery (PITR) disponible en option.
- **Avant la production : passer le projet en plan Pro et vérifier l'onglet Backups.**

## 2. À activer avant la production
1. Plan Pro Supabase (sauvegardes quotidiennes incluses).
2. Option PITR si le budget le permet (restauration à la minute près).
3. Export hebdomadaire hors-site via `node scripts/export-backup.mjs` (voir §4).

## 3. Exporter le schéma SQL
- Référence versionnée : `supabase/migrations/` (le schéma complet est reconstructible en
  rejouant les migrations dans l'ordre — c'est la source de vérité).
- Dump direct (optionnel) : Dashboard → Database → Migration/Schema, ou
  `supabase db dump --db-url "$DB_URL" -f schema.sql` (CLI Supabase, URL dans Settings → Database).

## 4. Exporter les données
- `node scripts/export-backup.mjs` → `backups/immopilot-backup-<date>.json`
  (16 tables + inventaire des fichiers Storage, aucun secret dans la sortie, dossier ignoré par Git).
- Lit `.env.local` (SUPABASE_SECRET_KEY) : à exécuter uniquement sur un poste de confiance.
- Chaque utilisateur dispose aussi de son export JSON/CSV dans Paramètres → Données (plan Starter+).

## 5. Sauvegarder les fichiers Storage
- L'export ci-dessus inventorie les chemins ; les binaires se téléchargent via
  Dashboard → Storage (par bucket) ou la CLI (`supabase storage cp -r ss://bucket ./local`).
- Buckets à couvrir : property-documents, property-photos, expense-receipts,
  profile-avatars, maintenance-files.

## 6. Restaurer sur un projet de test
1. Créer un projet Supabase séparé (JAMAIS le projet de production).
2. Rejouer les migrations de `supabase/migrations/` dans l'ordre (SQL Editor).
3. Recréer les 5 buckets privés.
4. Réimporter les données du JSON table par table dans l'ordre : profiles* → subscriptions →
   properties → tenants → leases → rent_payments → expenses → maintenance_records →
   documents → property_photos → notifications → le reste.
   (*profiles référence auth.users : créer d'abord les utilisateurs de test via l'API admin,
   ou restaurer un backup Supabase complet qui inclut auth.)
5. Réuploader les fichiers Storage sauvegardés.

## 7. Vérifier qu'une restauration fonctionne
- Pointer une instance locale (`.env.local`) vers le projet de test, se connecter avec un
  compte de test et vérifier : logements, baux, loyers, documents (URL signées), statistiques.
- `node scripts/rls-test.mjs` et `node scripts/beta-e2e-test.mjs` doivent passer sur le projet de test.

## 8. Qui peut déclencher une restauration
- Uniquement le propriétaire du projet Supabase (accès Dashboard + SUPABASE_SECRET_KEY).
- Ne jamais partager ces accès ; pas de restauration depuis un poste non maîtrisé.

## 9. Risques de perte de données
- Plan Free sans export récent : perte totale possible (pas de backup automatique).
- Entre deux sauvegardes quotidiennes : jusqu'à 24 h de données (réduit par PITR).
- Suppression de compte utilisateur : DÉFINITIVE et voulue (RGPD) — non couverte par les backups
  applicatifs ; seul un backup Supabase antérieur peut la retrouver.
- Storage : les backups Supabase ne couvrent pas les buckets → export §5 indispensable.

## 10. Fréquence recommandée
- Export `scripts/export-backup.mjs` : hebdomadaire (quotidien dès les premiers utilisateurs réels).
- Test de restauration complet sur projet de test : à chaque étape majeure, puis trimestriel.
- Vérification de l'onglet Backups Supabase : mensuelle.
