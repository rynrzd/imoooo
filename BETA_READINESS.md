# Bêta ImmoPilot — état de préparation (2026-07-16)

## Verdict : READY WITH LIMITATIONS

## Parcours validés (tests réellement exécutés)
- Landing → inscription : routes 200, Hero en premier, aucun faux bouton/checkout.
- Auth (API Supabase réelle) : inscription + e-mail envoyé, refus avant confirmation,
  mauvais mot de passe, mot de passe faible, rate-limit, récupération de mot de passe.
- Protection serveur : routes privées → redirection connexion ; publiques ouvertes.
- Isolation anonyme : lecture vide + écriture bloquée (RLS) sur les 9 tables.
- Technique : TypeScript 0 erreur, lint 0 erreur, build production 30 routes.

## P0 restants : aucun
## P1 restants : 1
- **Migrations abonnements non appliquées au projet distant** (`subscriptions`
  absente, limite de logements par plan inactive côté serveur).
  → Action : exécuter dans Supabase SQL Editor, dans l'ordre :
  `20260716090000_subscriptions.sql` puis `20260716150000_plans_v1.sql`.
  Sans cela : pas de blocage utilisateur, mais quota Free non imposé en base.

## P2 restants
- Tests runtime non exécutables sans navigateur/boîte mail (marqués BLOCKED
  dans BETA_QA_CHECKLIST.md) : confirmation e-mail de bout en bout, parcours UI
  complets, isolation croisée A/B authentifiée, responsive visuel, réseau lent.
- Route inconnue en anonyme → page de connexion (404 seulement connecté). Assumé.

## Fonctions désactivées (volontairement, en attendant les clés)
- Paiement en ligne (Stripe) : routes répondent 503, boutons → inscription/contact.
- Suppression de compte : « bientôt disponible » (contact support).
- Notifications e-mail (préférences non persistées) ; SMTP personnalisé non branché.

## Limitations de la bêta
- Plan Business sur devis (pas de multi-utilisateurs).
- Quittances/rappels automatiques : non annoncés, non inclus.

## Actions manuelles avant d'inviter des testeurs
1. Exécuter les 2 migrations ci-dessus (SQL Editor).
2. Vérifier les Redirect URLs Supabase (localhost + domaine de bêta).
3. Dérouler une fois le parcours complet dans un navigateur avec une vraie
   adresse (confirmation e-mail incluse) + un second compte pour l'isolation.
4. Optionnel : peupler un compte test via `scripts/seed-dev.mjs`.
