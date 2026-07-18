# AUTH_VERCEL_FIX_REPORT — 2026-07-18

## Cause exacte — inscription locale
Supabase renvoie **500 `unexpected_failure` « Error sending confirmation email »** :
le SMTP configuré dans le Dashboard Supabase est invalide (échec même vers
gamixrs@gmail.com, alors que la clé Resend de `.env.local` envoie correctement).
Le fallback générique masquait ce message. De plus, Resend en mode test
(`onboarding@resend.dev`) n'autorise l'envoi **que vers gamixrs@gmail.com**.

## Cause — Vercel : CONFIRMÉE par reproduction locale
« Failed to collect page data for /auth/callback » reproduit à l'identique en
buildant sans variables (`VERCEL=1`, `.env.local` retiré). La vraie erreur
s'affiche juste au-dessus dans les logs : `Configuration Supabase invalide —
NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont absentes`
(throw volontaire de `src/lib/supabase/config.ts:105` à l'import du module).
Fix : renseigner les variables dans Vercel (environnements Production ET
Preview) puis redéployer. Aucune ligne de `/auth/callback` n'est fautive.
Avec variables présentes : build exit 0.

## Corrections appliquées (code)
- `src/lib/supabase/auth-errors.ts` : log diagnostic (code+statut+message, dev
  uniquement, sans secret) + message dédié « e-mail de confirmation impossible »
  pour les échecs SMTP (au lieu du fallback générique).
- Aucun autre fichier code : formulaire, callback, proxy et triggers sont sains.

## Fichiers à commit/push manuellement
`src/lib/supabase/auth-errors.ts` · `AUTH_SETUP.md` · `AUTH_VERCEL_FIX_REPORT.md`

## Actions manuelles Supabase (bloquantes pour l'inscription)
1. **Auth → Emails → SMTP Settings** : Host `smtp.resend.com`, Port 465,
   Username `resend`, Password = clé Resend ACTIVE, Sender `ImmoPilot
   <onboarding@resend.dev>` (voir AUTH_SETUP.md §5).
2. Pour d'autres adresses que gamixrs@gmail.com : vérifier un domaine sur
   resend.com/domains puis changer le Sender.
3. **Auth → URL Configuration** : Redirect URLs = localhost + URL Vercel
   (4 entrées, AUTH_SETUP.md §2).

## Actions manuelles Vercel
1. Renseigner : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
   SUPABASE_SECRET_KEY, NEXT_PUBLIC_SITE_URL=https://URL-VERCEL-RÉELLE,
   RESEND_API_KEY, EMAIL_PROVIDER, EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS,
   SUPPORT_EMAIL, CRON_SECRET (+ variables Stripe quand disponibles).
   Noms conformes au code — pas de variante `ANON_KEY` ni `STRIPE_STARTER_PRICE_ID`.
2. Redéployer après toute modification de variable.
3. Lire les build logs si l'échec persiste : le message d'erreur de
   `src/lib/supabase/config.ts` nomme la variable fautive.

## Tests locaux
- Inscription (nouvel email) : **FAIL** → BLOCKED par SMTP Dashboard (action 1).
- Mauvais mot de passe → `invalid_credentials` + message français : **PASS**
- Connexion API (user confirmé) : **PASS** · Triggers profil + abonnement
  Free créés une seule fois : **PASS** (user de test admin, supprimé après).
- Accès privé sans session → redirection /connexion : **PASS**
- Callback lien invalide → /connexion?erreur=lien-invalide : **PASS**
- Routes publiques (/, /inscription, /connexion, /tarifs…) : **PASS**
- Confirmation e-mail, mot de passe oublié (envoi) : **BLOCKED** (SMTP).
- TypeScript : PASS (0 erreur) · ESLint : PASS (2 warnings préexistants)
- `npm run build` + `next start` production : **PASS**

## Tests Vercel
**BLOCKED** — aucun accès CLI/logs/URL. Procédure : pousser les 3 fichiers,
vérifier les variables, redéployer, puis dérouler les 10 tests (landing,
inscription, e-mail, confirmation, callback, connexion, dashboard,
déconnexion, reconnexion, mot de passe oublié).

## Verdict
- LOCAL AUTH : **NOT FIXED côté code seul** — code prêt, débloqué dès l'action
  manuelle SMTP (cause hors du dépôt, dans le Dashboard Supabase).
- VERCEL : **READY WITH MANUAL ACTIONS** (variables + redéploiement + tests).

## Prochaine action exacte
Corriger le SMTP dans le Dashboard Supabase (§5 AUTH_SETUP.md), tester
`/inscription` avec gamixrs@gmail.com, puis configurer les variables Vercel.
