# Paramètres & sécurité du compte — état (2026-07-17)

## Sections terminées (toutes réelles, aucun succès simulé)
- **Profil** : nom/téléphone/entreprise persistés (colonne `company_name` ajoutée),
  avatar réel (upload/remplacement/suppression, bucket privé, URL signée).
- **E-mail** : changement via Supabase Auth (jamais la table profiles), mot de
  passe actuel revérifié, double confirmation par e-mail gérée.
- **Mot de passe** : mot de passe actuel vérifié (réauthentification réelle),
  indicateur de robustesse, comportement des sessions documenté dans l'UI.
- **Sessions** : session actuelle (dernière connexion), déconnexion locale et
  globale (`signOut scope global`). Liste des appareils non fournie par
  Supabase → limitation affichée honnêtement, rien de fabriqué.
- **Notifications** : 7 préférences persistées (table `notification_preferences`,
  RLS own-only), sauvegarde à chaque bascule avec revert si échec ; mention
  claire que l'envoi automatique n'est pas encore actif.
- **Apparence** : thème clair/sombre/système (next-themes, persistant localement).
- **Abonnement** : plan réel (PlanBadge), usage logements/limite avec jauge,
  liens Plans/Tarifs, aucun paiement fictif.
- **Données** : exports JSON/CSV réels, catégories stockées, liens légaux,
  Support (FAQ, /contact, signalement bug, version).
- **Suppression de compte** : route serveur `/api/account/delete` — session +
  phrase exacte + mot de passe revérifié, purge Storage (5 buckets) puis
  suppression Auth (cascade DB). 503 explicite si `SUPABASE_SECRET_KEY` absente.

## Non fait (assumé)
- MFA/TOTP : non implémenté, non affiché (pas de fausse protection).
- Journal de sécurité : pas de table dédiée (pas nécessaire à ce stade).
- Langue/fuseau/devise : app FR/EUR uniquement — pas de faux réglages.

## Actions manuelles
1. Exécuter `supabase/migrations/20260717090000_account_settings.sql` (SQL Editor).
2. Exécuter `20260716180000_protect_plan_column.sql` si pas encore fait.
3. Renseigner `SUPABASE_SECRET_KEY` dans `.env.local` pour activer la
   suppression de compte (sinon le bouton explique le blocage, sans simuler).

## Prochaine action exacte
Exécuter la migration 1, puis tester en navigateur connecté : profil, avatar,
e-mail, mot de passe, notifications, suppression avec un compte jetable.
