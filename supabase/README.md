# Supabase — actions à faire dans le dashboard (une seule fois)

L'application est prête côté code. Trois actions restent à faire dans le
dashboard Supabase (https://supabase.com/dashboard → projet `vetzweeeywgxytuqspqb`).

## 1. Créer le schéma (OBLIGATOIRE — actuellement aucune table n'existe)

Dans **SQL Editor → New query**, exécuter dans cet ordre :

1. le contenu complet de [`migrations/20260714120000_init.sql`](migrations/20260714120000_init.sql)
   (tables, RLS, triggers, buckets Storage) ;
2. le contenu complet de [`migrations/20260715090000_profiles_email_plan.sql`](migrations/20260715090000_profiles_email_plan.sql)
   (colonnes `email` + `plan='free'` sur `profiles`, création de profil idempotente) ;
3. le contenu complet de [`migrations/20260715150000_app_extensions.sql`](migrations/20260715150000_app_extensions.sql)
   (fournisseur des dépenses, expiration des documents, suivi de chantier
   enrichi, bucket `maintenance-files`).

Vérification : **Table Editor** doit lister `profiles`, `properties`, `tenants`,
`leases`, `rent_payments`, `documents`, `property_photos`, `maintenance_records`,
`expenses` — et **Storage** les buckets `property-documents`, `property-photos`,
`expense-receipts`, `profile-avatars`, `maintenance-files`.

## 2. Configurer les URLs d'authentification

**Authentication → URL Configuration** :

- **Site URL** : `https://immopilot-silk.vercel.app`
- **Redirect URLs** — ajouter :
  - `https://immopilot-silk.vercel.app/auth/callback`
  - `https://immopilot-silk.vercel.app/**`
  - (production, plus tard : `https://votre-domaine.fr/auth/callback` et `https://votre-domaine.fr/**`)

Sans cette étape, le lien des e-mails de confirmation redirige vers une URL
refusée et échoue.

## 3. Templates d'e-mails et suite

Voir [AUTH_SETUP.md](../AUTH_SETUP.md) (racine du projet) : templates
d'e-mails personnalisés (OBLIGATOIRES — le template par défaut échoue hors
du navigateur d'origine), SQL de vérification/réparation, SMTP Resend et
procédure de test mobile.

