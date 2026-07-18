# QA_SINGLE_AGENT_REPORT — 17-18/07/2026

Agent QA unique, sans outil navigateur : tests réels en HTTP/API (serveur dev
localhost:3000, Supabase et Stripe de test réels). Aucun résultat simulé —
tout ce qui exige un navigateur ou une session confirmée est marqué BLOCKED.

## Préparation — PASS
- Un seul serveur sur :3000 (PID 16672). Supabase accessible (clé publishable).
- Migrations vérifiées : colonnes onboarding, RPC `founder_offer_status` (répond {confirmed:0}).
- Aucune clé dans le log dev (l'unique motif détecté = texte d'aide « whsec_… » d'un message d'erreur).

## Parcours exécutés
| Parcours | Résultat |
| --- | --- |
| 11 pages publiques (landing, tarifs, légales, auth) | PASS — toutes 200, aucun lien mort interne |
| Prix affichés 14,9/29,9/79,9 € + badges Business+ + CTA /abonnement + « à venir » marqués | PASS |
| Offre Fondateur au-dessus des tarifs | BLOCKED navigateur (rendu client) — code+RPC vérifiés ; absente du HTML serveur (P2 noté) |
| 9 routes privées sans session → 307 /connexion | PASS |
| API privées sans session (checkout, founder, portal, delete) → 401 | PASS |
| Inscription nouvel email (API réelle) : compte créé, email envoyé, AUCUNE session | PASS |
| Connexion non confirmé → email_not_confirmed (aucun accès) | PASS |
| Email inconnu / mauvais mot de passe → invalid_credentials (pas d'énumération) | PASS |
| Récupération mot de passe → 200 neutre | PASS |
| Callback : code invalide/absent/otp_expired → messages FR distincts ; next=//evil bloqué | PASS (exécuté ce jour) |
| Webhook Stripe non signé / mal signé → 400 | PASS |
| Sessions Checkout réelles (subscription + payment) via API Stripe test | PASS (exécuté ce jour) |
| Inscription email existant (écran neutre) | Code vérifié ; non exécuté (éviter un compte parasite sur une adresse réelle) |
| Onboarding, plan Free, quotas, modules métier, suppressions, A/B, Business+, mobile 390px | BLOCKED (voir ci-dessous) |

## Bugs
- P0 : aucun reproduit sur le périmètre testé.
- P1 (environnement, pas code) : `SUPABASE_SECRET_KEY` rejetée (401) — y compris la
  clé régénérée aujourd'hui. Conséquences : le webhook Stripe ne peut pas écrire
  `subscriptions` (aucun plan ne s'activera), Fondateur, suppression de compte et
  sync cassés. Vérifier dans Supabase → Settings → API Keys que la clé secrète est
  ACTIVE et copiée du projet `vetzweeeywgxytuqspqb` (pas d'un autre projet).
- P2 (noté, non corrigé — compromis) : section Fondateur invisible avant hydratation
  (SSR null) ; `/api/rent-reminder` répond 503 avant le contrôle de session (P3).
- Bugs corrigés pendant cette QA : aucun nécessaire (aucun P0/P1 code reproduit).

## Débloquer la suite (dans l'ordre)
1. Corriger la clé secrète (ci-dessus) — débloque webhook, Fondateur, suppression, QA A/B.
2. Confirmer le compte QA `gamixrs+qa-immopilot-1@gmail.com` (lien reçu dans votre
   boîte, ou Dashboard → Authentication → Users → Confirm) pour les parcours connectés.
3. Coller les templates d'e-mails + URLs (AUTH_SETUP.md) et `stripe listen` (STRIPE_SETUP.md).
4. Relancer la QA connectée : onboarding unique, quotas Free/Starter/Pro, modules,
   suppressions, sécurité A/B (2 comptes), Business+, mobile 390 px (navigateur requis).

## Comptes de test à nettoyer manuellement
- `gamixrs+qa-immopilot-1@gmail.com` (non confirmé, créé par cette QA).
- Vérifier `gamixrs+ipilot-test-a@gmail.com` (tentative du 17/07, refusée en 429).

## Contrôles techniques — PASS
TypeScript 0 erreur · ESLint 0 erreur (2 warnings préexistants) · build production OK.

## Verdict
**NOT READY** — le code testé est sain (auth, protections, Stripe côté serveur),
mais la clé secrète Supabase invalide empêche toute activation de plan payant, et
les parcours connectés (onboarding, quotas, A/B, mobile) restent non testés.
Prochain parcours exact : après déblocage 1-2 → « connexion compte QA →
onboarding → premier logement → tentative 2ᵉ logement (quota Free) ».
