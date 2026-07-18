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
- **Redirect URLs** : `http://localhost:3000/auth/callback` et `http://localhost:3000/**`
- Production, le moment venu : `https://VOTRE-DOMAINE/auth/callback` + `https://VOTRE-DOMAINE/**`

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

## 4. Clé secrète invalide (constaté : 401)

`SUPABASE_SECRET_KEY` de `.env.local` est **rejetée par l'API** (révoquée ou
régénérée). Conséquence : suppression de compte et webhook Stripe cassés.
**Settings → API Keys** → copier la clé `sb_secret_…` active → remplacer la
valeur dans `.env.local` → redémarrer le serveur.

## 5. Limite d'envoi d'e-mails (constaté : erreur 429 aujourd'hui)

Le SMTP intégré Supabase est limité à ~2 e-mails/heure — inutilisable au-delà
des premiers tests. Pour la production : **Authentication → Emails → SMTP
Settings** avec Resend :

- Host `smtp.resend.com` · Port `465` · Username `resend`
- Password : une clé API Resend (créer une clé dédiée, ne pas réutiliser celle du code)
- Sender : une adresse d'un **domaine vérifié** chez Resend (SPF, DKIM puis
  DMARC configurés via les DNS que Resend affiche) — `onboarding@resend.dev`
  ne convient qu'aux tests vers votre propre boîte.

Non appliqué ni testé ici — à activer quand le domaine est vérifié.

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
