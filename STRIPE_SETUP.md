# STRIPE_SETUP — webhook, test et mise en production

## 1. Webhook à enregistrer

- **URL** : `https://VOTRE-DOMAINE/api/stripe/webhook`
  (en local, pas d'URL publique : utiliser le Stripe CLI, voir §3).
- **Événements à sélectionner** :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

## 2. Variable

`STRIPE_WEBHOOK_SECRET` (`whsec_…`) dans `.env.local` (ligne déjà préparée, vide) :
- en local : le secret affiché par `stripe listen` ;
- en production : le « Signing secret » du webhook créé dans le Dashboard
  (Developers → Webhooks). Redémarrer le serveur après modification.

## 3. Procédure de test (mode test)

1. **Préalable bloquant** : régénérer `SUPABASE_SECRET_KEY` (l'actuelle est
   rejetée en 401 — sans elle le webhook ne peut pas écrire `subscriptions`).
   Supabase Dashboard → Settings → API Keys → copier la clé `sb_secret_…` active.
2. Installer le Stripe CLI, puis :
   `stripe login`
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   → copier le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`, redémarrer `npm run dev`.
3. Se connecter avec un compte de test → `/abonnement` → choisir un plan →
   payer avec la carte `4242 4242 4242 4242` (date future, CVC libre).
4. Vérifier : événements 200 dans le terminal `stripe listen`, ligne
   `subscriptions` mise à jour (plan, statut `active`), page Abonnement à jour.
5. Fondateur : page Tarifs → « Devenir Fondateur » → payer 299 € (carte test) →
   le webhook attribue la place (n°, tier, `lifetime_access`) et le compteur
   « places restantes » diminue. Échec de paiement : carte `4000 0000 0000 0002`.
6. Portail client : `/abonnement` → « Gérer mon abonnement » (changement de
   carte, annulation — l'annulation redescend le plan via le webhook).

## 4. Passage en production

1. Activer le compte Stripe (mode live) et recréer les 5 prix en live ;
   reporter les `price_…` live dans les variables d'environnement Vercel.
2. Remplacer `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   par les clés live (`sk_live_…`, `pk_live_…`).
3. Créer le webhook live sur `https://VOTRE-DOMAINE/api/stripe/webhook`
   avec les 6 événements du §1 → copier son `whsec_…` en variable Vercel.
4. `NEXT_PUBLIC_SITE_URL` = domaine de production (success/cancel URLs).
5. Test réel à 1 € déconseillé : utiliser d'abord un paiement test complet
   en préproduction, puis surveiller Developers → Webhooks (livraisons 200).
