# ImmoPilot — Préproduction (2026-07-16)

## État
- **Fournisseur e-mail** : NON ACTIF — adaptateur Resend/Brevo/Postmark prêt,
  variables absentes de .env.local (EMAIL_PROVIDER, EMAIL_FROM_ADDRESS,
  RESEND_API_KEY). Sans clé : 503 `provider_not_configured` vérifié, zéro envoi.
- **Domaine d'envoi** : NON VÉRIFIÉ — procédure DNS (SPF/DKIM/DMARC) : docs/EMAILS.md.
- **E-mails Supabase Auth** : NON CONFIGURÉS (SMTP à régler dans le Dashboard,
  procédure docs/EMAILS.md §3). Redirections passées sur NEXT_PUBLIC_SITE_URL.
- **Relance manuelle** : logique VALIDÉE (503 sans fournisseur, 401 sans session,
  anti double-clic 60 s, anti-doublon 1/jour/échéance en 409, email_logs +
  notification après retour fournisseur). Envoi réel non testé (pas de clé).
- **Automatisation** : PRÊTE, non activée — cron GET+POST, Bearer CRON_SECRET
  (401 mauvais secret, 200 idempotent testés), snippet Vercel docs/EMAILS.md §4.
- **E-mail de test** : Paramètres → Notifications, 9 modèles, destinataire =
  compte connecté imposé serveur, 5/h, journalisé, jamais de succès simulé.
- **Notifications** : VALIDÉES (RLS own-only, dedupe_key, lu/non-lu/tout
  lu/suppression/pagination). Corrigé : « marquer lu » ne navigue plus ;
  « marquer non lu » ajouté. Filtre par catégorie absent (P3).
- **Onboarding / visite guidée** : code revu (jamais bloquant, ignorable,
  onboarding_completed) — test navigateur avec compte neuf à faire à la main.
- **Contact** : formulaire réel (POST /api/contact) : validation Zod, honeypot
  silencieux, 3/10 min/IP, stockage contact_messages puis e-mails support +
  accusé si fournisseur. Testé : 400/200/429 OK ; 502 tant que la migration
  n'est pas exécutée (aucun faux succès).
- **Pages légales** : présentes (+/cookies honnête sans bannière inutile) ;
  placeholders « [À compléter] » clairement signalés (éditeur, hébergeur,
  clauses) — à remplir avant ouverture commerciale.
- **Sécurité** : HTML des e-mails désormais échappé (esc/escUrl) ; aucune clé
  côté navigateur ; .env.local ignoré par Git ; RLS own-only relue sur
  notifications/email_logs/preferences ; contact_messages sans policy
  (service-role uniquement). Test croisé 2 comptes réels à faire à la main.

## Corrections apportées
P1 : injection HTML possible dans les e-mails via valeurs utilisateur (échappé).
P1 : cron incompatible Vercel Cron (GET ajouté). P2 : « marquer lu » naviguait.
P2 : contact = simple mailto (remplacé par envoi réel + stockage).
P2 : redirections auth sur window.location.origin (→ NEXT_PUBLIC_SITE_URL).

## P0 restants : aucun.
## P1 restants : aucun dans le code. Bloquants de CONFIGURATION : clé e-mail,
domaine vérifié, SMTP Supabase, migration contact_messages non exécutée.

## Gates
TypeScript : 0 erreur · Lint : 0 erreur (2 warnings RHF bénins) ·
Build : 36 routes OK · Routes testées via serveur réel (503/401/400/409/429/200).

## Verdict : READY WITH LIMITATIONS
Le code est prêt ; aucun envoi d'e-mail réel n'a pu être testé faute de clé
fournisseur. Ne pas annoncer les e-mails avant les actions ci-dessous.

## Prochaines actions manuelles (ordre)
1. Exécuter supabase/migrations/20260718090000_contact_messages.sql (SQL Editor).
2. Créer la clé Resend + renseigner EMAIL_PROVIDER/EMAIL_FROM_NAME/
   EMAIL_FROM_ADDRESS/RESEND_API_KEY/SUPPORT_EMAIL/CRON_SECRET dans .env.local.
3. Paramètres → « Envoyer un e-mail de test » (vérifier réception réelle).
4. Vérifier le domaine dans Resend (DNS) puis configurer le SMTP Supabase Auth.
5. Compléter les placeholders légaux ; test manuel onboarding + 2 comptes (RLS).
