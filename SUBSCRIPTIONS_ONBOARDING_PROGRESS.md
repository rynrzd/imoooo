# Abonnements, Fondateur, Onboarding — état (2026-07-16)

## Terminé (TS 0 erreur · lint 0 erreur · build 38 routes)
- **Plans centralisés** : `src/config/plans.ts` (source unique — prix, limites,
  fonctionnalités, ordre, Stripe Price env). Grille V1 : Free 0 € (1 logement,
  1 locataire, 20 docs/photos, 50 Mo) · Starter 14,90 € (10 logements) ·
  Pro 29,90 € (30) · Business+ 79,90 € (illimité). `src/lib/stripe/plans.ts`
  ré-exporte (compatibilité). Tarifs/comparatif/abonnement/badge dérivés.
- **Limites serveur** : migration `20260719090000_plans_v2_founder.sql` —
  triggers `enforce_property/active_tenant/document/photo_limit` (plan lu dans
  profiles.plan, contrôlé serveur). Lib : getUserSubscription, getPlanDefinition,
  getUsage, getRemainingQuota, canCreateProperty/Tenant, canUploadDocument/Photo,
  hasFeature/userHasFeature/requirePlan. Store : mêmes checks côté UI (info).
- **subscriptions** : + provider (manual/stripe/founder), lifetime_access,
  founder_tier, founder_purchase_number ; statuts normalisés ; Free auto à
  l'inscription (trigger auth.users) + réparation des comptes existants ;
  RLS lecture seule (aucune écriture client).
- **Fondateur** : founder_purchases (place UNIQUE par user, numérotation
  atomique `confirm_founder_purchase` via advisory lock, idempotente webhook,
  confirmée uniquement après paiement `paid`) ; tier 1 (1-50, 299 €) → tier 2
  (51-100, 499 €) calculés serveur ; épuisé à 100 → bloc masqué.
  founder_waitlist (sans Stripe : liste prioritaire, zéro réservation).
  Bloc Tarifs réel (compteur via RPC founder_offer_status, jamais inventé).
- **Stripe** : checkout mensuel starter/pro/business, founder-checkout
  (paiement unique), portail, webhook (sync + confirmation Fondateur,
  lifetime jamais écrasé). Sans clés : 503 partout, aucun faux bouton.
- **Feature gates** : relance manuelle = Starter+ (403 sinon), relances
  automatiques cron = Pro+ (skip). Carte/centre de pilotage Business+ : NON
  développés (mission suivante) — affichés « à venir », aucun faux accès.
- **Onboarding** : condition stricte (profiles.onboarding_completed en base,
  + onboarding_completed_at) ; migration marque TOUS les comptes existants
  comme terminés (aucun ancien utilisateur forcé) ; relance manuelle seule.
- **Abonnement (page + Paramètres)** : plan/statut réels (table subscriptions),
  badge Fondateur numéroté, quotas consommés réels, dates début/renouvellement,
  portail seulement si provider=stripe.

## Actions manuelles restantes
1. Exécuter `supabase/migrations/20260719090000_plans_v2_founder.sql`
   (SQL Editor) — sans elle : waitlist 502, quotas V1 (anciens) en base.
2. Quand Stripe sera prêt : créer les produits (Starter/Pro/Business+ mensuels,
   Fondateur T1/T2 one-time), renseigner STRIPE_* (.env.example à jour),
   webhook avec `checkout.session.completed` + `customer.subscription.*`.
3. Tester en réel : nouveau compte → Free auto + onboarding unique ;
   2e logement en Free → blocage serveur ; achat Fondateur test → place n°1.
