# AUTH_FINAL_REPORT — 18/07/2026

## Problèmes trouvés (reproduits, pas supposés)
1. **Aucun compte jamais confirmé** (4/4 non confirmés en base) : les liens des
   e-mails par défaut (PKCE) échouent hors du navigateur d'origine et les
   templates personnalisés n'étaient pas encore installés dans le Dashboard.
2. **`EMAIL_PROVIDER` absent de `.env.local`** : Resend jamais actif — aucun
   e-mail transactionnel (bienvenue, relances, rapports) ne partait.
3. **Serveur dev périmé** : tournait avec l'ancien environnement (clé admin
   invisible pour l'app).
4. Faux diagnostic antérieur corrigé : la clé `SUPABASE_SECRET_KEY` régénérée
   est **valide** (mes tests précédents échouaient à cause du client HTTP
   PowerShell, pas de la clé — vérifié via curl : 200).
5. E-mail de bienvenue écrit mais jamais branché ; e-mails Resend en bleu
   décalé de l'identité produit.

## Corrigé / réécrit
- `.env.local` : `EMAIL_PROVIDER=resend` ajouté ; serveur redémarré (un seul, port 3000).
- Callback : envoi de l'e-mail de **bienvenue à la première confirmation**
  (idempotent via email_logs, jamais bloquant).
- E-mails Resend alignés sur l'identité sobre (noir #111827), même design que
  les templates Supabase déjà fournis dans `supabase/email-templates/`.
- Le reste (callback token_hash, inscription neutre, messages FR,
  /verification-email, proxy e-mail confirmé, onboarding 4 étapes persistant,
  visite guidée séparée/manuelle) avait été réécrit le 17/07 — re-testé ce jour.

## Tests RÉELS exécutés (aucun simulé)
- Connexion compte confirmé → session ✓ · e-mail inconnu / mauvais mdp →
  `invalid_credentials` ✓ · non confirmé → `email_not_confirmed` ✓.
- **Confirmation E2E** : lien réel (admin generate_link) → `/auth/callback` →
  307 « / » + cookies de session ✓ ; dashboard 200 connecté ✓ ; **lien rejoué →
  « lien-expire »** ✓ ; /connexion connecté → redirigé ✓.
- **Récupération mdp E2E** : lien réel → formulaire dédié → changement →
  reconnexion avec le nouveau mdp ✓ → ancien refusé ✓.
- **Onboarding** : UPDATE `onboarding_completed` avec session utilisateur →
  200 persisté ✓ (grants en base corrects — pas de boucle possible).
- **Sécurité A/B** (2 comptes réels créés puis supprimés) : B ne lit ni ne
  modifie rien de A (logements, profil, abonnement — RLS étanche) ✓ ;
  quota Free appliqué par le serveur (2ᵉ logement refusé, message FR) ✓ ;
  auto-attribution de plan bloquée (42501) ✓.
- Profil + abonnement Free auto-créés à l'inscription (triggers) ✓.
- Cron admin+e-mails fonctionnel après correctifs (`{"sent":0,"skipped":0}`) ✓.

## Actions manuelles restantes (Dashboard — 5 min, voir AUTH_SETUP.md)
1. **Coller les 3 templates d'e-mails** (Authentication → Emails) — c'est CE
   qui rend les liens fiables sur tout appareil. 2. Vérifier Site URL +
   Redirect URLs. 3. SMTP Resend pour Auth en production (quota intégré ~2/h).
4. Supprimer les comptes de test : `qa.immopilot.a@gmail.com`,
   `jvnkjfndhjn@gmail.com` (+ `rayan.benche90@gmail.com` si non voulu).
   Compte QA conservé pour vos tests navigateur :
   `gamixrs+qa-immopilot-1@gmail.com` / mdp `NouveauMdpQa2026!` (confirmé).

## Qualité
TypeScript 0 erreur · ESLint 0 erreur (2 warnings préexistants) · Build OK.

## Verdict
Backend d'authentification **digne d'un SaaS** : tout ce qui est côté code et
base est vérifié réel (confirmation, récupération, isolation, quotas, plans).
Il ne reste que l'installation des templates dans le Dashboard pour que le
parcours e-mail soit irréprochable sur tous les appareils. Tests navigateur
(desktop/mobile) à faire avec le compte QA ci-dessus.
