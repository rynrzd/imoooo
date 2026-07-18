# AUTH_SETUP — actions manuelles Supabase (obligatoires)

Le code est corrigé, mais ces réglages vivent dans le Dashboard Supabase
(<https://supabase.com/dashboard> → projet `vetzweeeywgxytuqspqb`) et ne
peuvent pas être appliqués automatiquement. Rien ci-dessous n'a été appliqué
à votre place.

## 1. SQL de vérification / réparation (2 min — corrige la visite qui revient)

**SQL Editor → New query** : exécuter tout [`supabase/verifier_reparer_auth.sql`](supabase/verifier_reparer_auth.sql).
Idempotent, aucune donnée touchée. La vérification A doit lister 7 colonnes
(dont `onboarding_completed`) — sans elles, l'enregistrement de l'onboarding
échoue et l'assistant revient à chaque connexion.

## 2. URLs d'authentification

**Authentication → URL Configuration** :

- **Site URL** : `http://localhost:3000` (les liens des e-mails pointent dessus)
- **Redirect URLs** — ajouter les QUATRE entrées (local + Vercel) :
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`
  - `https://VOTRE-URL.vercel.app/auth/callback`
  - `https://VOTRE-URL.vercel.app/**`
- Domaine personnalisé le moment venu : `https://VOTRE-DOMAINE/auth/callback` + `https://VOTRE-DOMAINE/**`
- Quand la production devient prioritaire, basculer la **Site URL** sur l'URL
  Vercel (les Redirect URLs ci-dessus continuent de couvrir le local).

## 3. Templates d'e-mails (corrige le lien de confirmation cassé)

**Authentication → Emails (Templates)** — coller le contenu de chaque fichier
de [`supabase/email-templates/`](supabase/email-templates/) :

| Template Dashboard   | Fichier                              | Objet à saisir                                    |
| -------------------- | ------------------------------------ | ------------------------------------------------- |
| Confirm signup       | `confirmation-inscription.html`      | Confirmez votre compte ImmoPilot                  |
| Reset password       | `reinitialisation-mot-de-passe.html` | Réinitialisez votre mot de passe ImmoPilot        |
| Change email address | `changement-email.html`              | Confirmez votre nouvelle adresse e-mail ImmoPilot |

Pourquoi : le template par défaut (`{{ .ConfirmationURL }}` + flux PKCE)
échoue si le lien est ouvert dans un autre navigateur ou appareil que celui
de l'inscription. Les nouveaux templates utilisent `token_hash`, fiable
partout. Ils suivent la **Site URL** du Dashboard.

## 4. Clé secrète — RÉSOLU (vérifié le 2026-07-18)

`SUPABASE_SECRET_KEY` de `.env.local` est désormais acceptée par l'API admin.
Rien à faire.

## 5. SMTP cassé — CAUSE ACTUELLE de « Inscription impossible » (2026-07-18)

Constaté : **toute** inscription échoue en 500 `unexpected_failure`
« Error sending confirmation email », y compris vers l'adresse du compte
Resend. La clé Resend de `.env.local` fonctionne (envoi direct testé OK) :
c'est donc la **configuration SMTP du Dashboard Supabase** qui est invalide
(clé/expéditeur différents ou révoqués).

Corriger dans **Authentication → Emails → SMTP Settings** :

- Host `smtp.resend.com` · Port `465` · Username `resend`
- Password : une clé API Resend **active** (Resend → API Keys ; recréez-en une
  au besoin et collez-la ici)
- Sender email : `onboarding@resend.dev` · Sender name : `ImmoPilot`

⚠️ Limite Resend en mode test : `onboarding@resend.dev` n'envoie **que vers
gamixrs@gmail.com** (propriétaire du compte Resend). Toute inscription avec
une autre adresse échouera encore en 500. Pour de vrais utilisateurs :
vérifier un domaine sur <https://resend.com/domains> (DNS SPF + DKIM), puis
mettre Sender email sur ce domaine et aligner `EMAIL_FROM_ADDRESS`.
Après modification, testez sur `/inscription` avec `gamixrs@gmail.com` et
consultez **Authentication → Logs** en cas d'échec.

## 6. Test depuis un téléphone

Un lien `http://localhost:3000` ne fonctionne **jamais** depuis un téléphone.
Procédure propre :

1. déployer une preview Vercel du projet ;
2. `NEXT_PUBLIC_SITE_URL` = URL de la preview (variables Vercel) ;
3. ajouter `https://PREVIEW.vercel.app/auth/callback` et `https://PREVIEW.vercel.app/**`
   aux Redirect URLs, et mettre la **Site URL** du Dashboard sur la preview ;
4. s'inscrire avec une adresse neuve → ouvrir l'e-mail sur le téléphone.

Alternative ponctuelle : tunnel sécurisé (`cloudflared tunnel --url http://localhost:3000`),
mêmes réglages avec l'URL du tunnel. Revenir à `http://localhost:3000` ensuite.

## 7. Comptes de test à nettoyer (manuellement)

La requête D de `verifier_reparer_auth.sql` les liste. Tenté pendant ce
diagnostic (inscription refusée en 429, compte probablement absent) :
`gamixrs+ipilot-test-a@gmail.com` — s'il apparaît dans **Authentication →
Users** sans confirmation, il est supprimable. Ne jamais supprimer un compte réel.
