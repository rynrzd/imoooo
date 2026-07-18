# BETA DEPLOYMENT READINESS — ImmoPilot (17/07/2026)

## Verdict : READY WITH LIMITATIONS

## Parcours validés (tests réels sur Supabase, comptes jetables supprimés après)
- E2E nouvel utilisateur (15/15 PASS — scripts/beta-e2e-test.mjs) : inscription → Free auto
  → onboarding une seule fois → logement (créer/modifier) → locataire + bail → échéances
  (retard/partiel/payé/suppression) → travaux + dépense liée → document (upload/URL signée/
  suppression fichier) → photo → suppression bail (vacant, zéro orphelin) → suppression
  logement (cascade 6 tables) → suppression compte (Auth + profil + abonnement).
- Sécurité multi-utilisateurs (13/13 PASS — scripts/rls-test.mjs) : isolation lecture/écriture/
  suppression, owner_id falsifié bloqué, plan non modifiable (colonne protégée), subscriptions
  en lecture seule, Storage privé (URL signée refusée, listing vide), notifications isolées,
  quota Free appliqué par trigger serveur.
- Routes publiques : /, /connexion, /inscription, /mot-de-passe-oublie,
  /reinitialiser-mot-de-passe, /tarifs, /contact, /cgu, /confidentialite, /mentions-legales,
  /cookies, /sitemap.xml, /robots.txt → 200 ; /auth/callback public ; privées → 307 connexion.
- Landing : aucun href="#", tous les liens résolus, aucun paiement simulé (Fondateur = liste
  d'attente sans Stripe).
- Abonnements : Free auto, limites par triggers (1/10/30/illimité), plan non contournable,
  aucun plan payant activable sans Stripe, boutons désactivés « bientôt disponible ».

## Problèmes restants
- P0 : aucun.
- P1 : aucun.
- P2 : e-mails applicatifs inactifs (EMAIL_PROVIDER + EMAIL_FROM_ADDRESS absents de
  .env.local — routes en 503 propre, e-mails d'auth Supabase non concernés) ; quota de
  stockage (Mo/Go) affiché mais non imposé techniquement (limites par nombre actives) ;
  responsive vérifié par revue de code (grilles, overflow, pagination) — passe visuelle
  navigateur 390/768/1024/1440 px recommandée avant l'annonce.
- P3 : route inconnue → redirection /connexion pour un visiteur (au lieu d'un 404).

## Actions manuelles Supabase (avant/pendant déploiement)
1. Appliquer toutes les migrations de supabase/migrations/ (apply_all.sql les regroupe).
2. Authentication → URL Configuration : Site URL = domaine production ;
   Redirect URLs = https://DOMAINE/auth/callback + https://DOMAINE/** (+ localhost pour le dev).
3. Vérifier l'existence des 5 buckets privés (property-documents, property-photos,
   expense-receipts, profile-avatars, maintenance-files).

## Variables Vercel nécessaires
- Obligatoires : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL (build échoue sans elle), NEXT_PUBLIC_APP_ENV=production,
  SUPABASE_SECRET_KEY (suppression de compte).
- Optionnelles (bêta) : EMAIL_PROVIDER, EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS, SUPPORT_EMAIL,
  RESEND_API_KEY, CRON_SECRET. Stripe : plus tard (voir DEPLOYMENT.md).

## État des intégrations
- Fournisseur e-mail : NON actif (clé Resend présente, provider/from manquants — volontaire).
- Stripe : NON actif (volontaire — aucun faux paiement affiché).
- Domaine : NON configuré (utiliser l'URL Vercel puis mettre à jour NEXT_PUBLIC_SITE_URL).

## Qualité
TypeScript : OK · ESLint : 0 erreur (2 warnings React Compiler pré-existants) ·
Build production : OK (38 pages) · .env.local ignoré par Git, aucun secret suivi,
aucun console.log, aucun chemin Windows codé en dur, aucune écriture disque persistante.
