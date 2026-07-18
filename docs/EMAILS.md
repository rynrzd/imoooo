# E-mails ImmoPilot — configuration du fournisseur (Resend recommandé)

Aucun envoi n'a lieu tant que les variables ne sont pas renseignées : les
routes répondent `provider_not_configured` (HTTP 503), jamais de faux succès.

## 1. Variables d'environnement (serveur uniquement)

```
EMAIL_PROVIDER=resend
EMAIL_FROM_NAME=ImmoPilot
EMAIL_FROM_ADDRESS=notifications@votre-domaine.fr
RESEND_API_KEY=            # clé « re_… » — JAMAIS exposée au navigateur
SUPPORT_EMAIL=contact@votre-domaine.fr
CRON_SECRET=               # long aléatoire : openssl rand -hex 32
```

Brevo (`BREVO_API_KEY`) et Postmark (`POSTMARK_SERVER_TOKEN`) restent
supportés via le même adaptateur (`src/lib/email/provider.ts`).

## 2. Domaine d'envoi (Resend)

1. Resend → **Domains → Add domain** : saisir `votre-domaine.fr`.
2. Ajouter chez votre registrar les enregistrements DNS affichés :
   - **SPF** : TXT `send.votre-domaine.fr` → `v=spf1 include:amazonses.com ~all` (valeur exacte donnée par Resend) ;
   - **DKIM** : 3 enregistrements CNAME/TXT `resend._domainkey…` fournis par Resend ;
   - **DMARC** (recommandé) : TXT `_dmarc.votre-domaine.fr` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@votre-domaine.fr; pct=100`.
3. Attendre le statut **Verified** dans Resend (propagation DNS : jusqu'à 48 h).
4. Choisir l'adresse d'envoi : `notifications@votre-domaine.fr` (transactionnel)
   et `contact@votre-domaine.fr` (support / réponse).

**Développement sans domaine vérifié** : `EMAIL_FROM_ADDRESS=onboarding@resend.dev`
— Resend n'accepte alors que des envois vers l'adresse du compte Resend.
Le domaine n'est vérifié que lorsque Resend l'affiche : ne rien présumer.

## 3. E-mails Supabase Auth (confirmation, mot de passe, changement d'e-mail)

Ces e-mails sont envoyés par Supabase, pas par l'application. Pour les faire
partir via votre domaine (recommandé en production — le SMTP intégré de
Supabase est limité à ~2 e-mails/h) :

1. Supabase Dashboard → **Authentication → Emails → SMTP Settings** :
   - Host `smtp.resend.com`, Port `465`, Username `resend`,
     Password = votre `RESEND_API_KEY`,
     Sender = `notifications@votre-domaine.fr` (domaine vérifié).
2. **Authentication → URL Configuration** :
   - Site URL = `NEXT_PUBLIC_SITE_URL` (ex. `https://votre-domaine.fr`) ;
   - Redirect URLs : ajouter `https://votre-domaine.fr/auth/callback`
     (+ `http://localhost:3000/auth/callback` pour le dev).
3. Les gabarits (Confirm signup, Reset password, Change email) peuvent être
   personnalisés dans **Authentication → Emails → Templates** — garder les
   variables `{{ .ConfirmationURL }}` intactes.

L'application utilise `NEXT_PUBLIC_SITE_URL` pour toutes les redirections
(`/auth/callback`), conformément à cette configuration.

## 4. Relances automatiques (Vercel Cron — à activer manuellement)

La route `/api/cron/rent-reminders` accepte GET et POST, exige
`Authorization: Bearer ${CRON_SECRET}` et est idempotente (email_logs).

Pour l'activer sur Vercel, ajouter dans `vercel.json` (non créé
volontairement — l'activation est une décision de déploiement) :

```json
{ "crons": [{ "path": "/api/cron/rent-reminders", "schedule": "0 8 * * *" }] }
```

puis définir `CRON_SECRET` dans les variables Vercel : Vercel ajoute
automatiquement le header `Authorization: Bearer ${CRON_SECRET}` à ses crons.
Sans `CRON_SECRET` ou sans fournisseur e-mail : 503 explicite, aucun envoi.

## 5. Test réel

Paramètres → Notifications → **E-mail de test** : envoie le modèle choisi à
l'adresse du compte connecté (préfixe [TEST], 5/heure, journalisé dans
`email_logs`). Le succès n'est affiché qu'après le retour HTTP du fournisseur.

## 6. Migration requise

Exécuter `supabase/migrations/20260718090000_contact_messages.sql`
(SQL Editor) : table des messages du formulaire de contact (RLS sans policy,
accès service-role uniquement).
