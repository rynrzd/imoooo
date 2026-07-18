# Déploiement ImmoPilot sur Vercel

## Étapes

1. Pousser le dépôt sur GitHub, puis connecter GitHub à Vercel (vercel.com → Add New → Project).
2. Sélectionner le dépôt `immopilot` (framework Next.js détecté automatiquement, Node ≥ 20).
3. Ajouter les variables d'environnement (Settings → Environment Variables) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (obligatoire : le build échoue sans elle)
   - `NEXT_PUBLIC_APP_ENV=production`
   - `SUPABASE_SECRET_KEY` (sb_secret_… — suppression de compte, webhook Stripe, cron)
   - E-mails (optionnel, voir docs/EMAILS.md) : `EMAIL_PROVIDER`, `EMAIL_FROM_NAME`,
     `EMAIL_FROM_ADDRESS`, `SUPPORT_EMAIL`, `RESEND_API_KEY` (ou BREVO/POSTMARK), `CRON_SECRET`
   - Stripe (plus tard) : `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
     `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`,
     `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_FOUNDER_T1`, `STRIPE_PRICE_FOUNDER_T2`
4. Lancer le premier déploiement.
5. Récupérer l'URL Vercel (`https://xxx.vercel.app`).
6. Mettre à jour `NEXT_PUBLIC_SITE_URL` avec cette URL (puis le domaine définitif).
7. Configurer Supabase (Authentication → URL Configuration) :
   - **Site URL** : `https://DOMAINE_PRODUCTION`
   - **Redirect URLs** (conserver les entrées localhost pour le développement) :
     - `https://DOMAINE_PRODUCTION/auth/callback`
     - `https://DOMAINE_PRODUCTION/**`
     - `http://localhost:3000/auth/callback` et `http://localhost:3000/**`
8. Redéployer (les variables ne s'appliquent qu'au build suivant).
9. Tester : inscription → e-mail de confirmation → connexion → création d'un
   logement → upload d'un document → déconnexion → mot de passe oublié.
10. Connecter le domaine personnalisé (Vercel → Domains), refaire 6 → 8.

## Migrations Supabase (SQL Editor, dans l'ordre)

Toutes les migrations de `supabase/migrations/` doivent être appliquées
DANS L'ORDRE des noms de fichiers (`init` → … → `plans_v2_founder` →
`perf_indexes`). `apply_all.sql` ne regroupe que les 3 premières :
exécuter ensuite chaque migration suivante dans le SQL Editor.

## E-mails d'authentification

Les templates Supabase par défaut fonctionnent (`{{ .ConfirmationURL }}`).
SMTP personnalisé (optionnel, plus tard) : Supabase → Authentication →
SMTP Settings — aucun changement de code nécessaire.
Les e-mails applicatifs (relances, contact) restent inactifs tant que
`EMAIL_PROVIDER` + clé + `EMAIL_FROM_ADDRESS` ne sont pas renseignés
(les routes répondent 503 avec un message clair — jamais de faux succès).

## Cron (relances automatiques — plan Pro)

Vercel → Settings → Cron Jobs : `GET /api/cron/rent-reminders` une fois
par jour. Définir `CRON_SECRET` (Vercel ajoute le header Authorization).

## Stripe (quand le compte sera créé)

1. Créer les produits mensuels : Starter 14,90 €, Pro 29,90 €, Business+ 79,90 €,
   et les paiements uniques Fondateur : palier 1 = 299 €, palier 2 = 499 €.
2. Copier les identifiants `price_…` dans les variables `STRIPE_PRICE_*`.
3. Renseigner `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Créer le webhook `https://DOMAINE_PRODUCTION/api/stripe/webhook`
   (événements : checkout.session.completed, customer.subscription.created/updated/deleted)
   → copier le secret dans `STRIPE_WEBHOOK_SECRET`.
5. Vérifier `SUPABASE_SECRET_KEY` (le webhook écrit `subscriptions` avec).
6. Tester en mode test (carte 4242 4242 4242 4242) avant les clés live.

## Monitoring (plus tard)

Point de branchement unique : `src/lib/logger.ts` (report()).
Événements à surveiller : `auth/*`, `stripe/*`, `storage/*`, `supabase/*`, `app/*`.
