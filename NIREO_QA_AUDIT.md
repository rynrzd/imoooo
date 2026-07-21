# NIREO — Audit QA (2026-07-21)

Tests réels exécutés contre Supabase/Stripe de test (comptes créés puis supprimés).
Aucune donnée mockée, aucun faux paiement, aucune clé secrète exposée.

## Résultats des tests automatisés réels

| Domaine | Test réel effectué | Résultat |
|---|---|---|
| Sécurité RLS A/B | B lit properties/expenses/rent_payments/maintenance/documents/photos/leases de A | 0 ligne — **PASS** |
| Sécurité RLS A/B | B lit subscriptions / founder_purchases / profiles / notif_preferences / notifications de A | 0 ligne — **PASS** |
| Sécurité écriture | B modifie/supprime logement de A | 0 ligne affectée — **PASS** |
| Sécurité écriture | B insère logement owner=A / s'auto-upgrade en business+lifetime | rejeté (400/403) — **PASS** |
| Storage isolation | A upload+download dans son dossier | 200 — **PASS** |
| Storage isolation | B upload/download dans le dossier de A (property-documents, property-photos) | rejeté (400) — **PASS** |
| Quotas serveur | 2ᵉ logement en plan Free via API directe | bloqué par trigger (« 1 logement maximum ») — **PASS** |
| Abonnement (source unique) | subscriptions=Fondateur mais profiles.plan=free → plan effectif | business — **PASS** |
| Abonnement (source unique) | subscriptions expiré mais profiles.plan=business → plan effectif | free — **PASS** |
| Abonnement (source unique) | aucune ligne subscriptions → plan effectif | free — **PASS** |
| Fondateur | 2ᵉ achat par un compte déjà à vie | 409 refusé, compteur intact — **PASS** |
| Activation Stripe (test) | abonnement Pro réel → /api/stripe/sync | plan=pro actif, idempotent — **PASS** |
| Suppression compte | compte + logements + abonnement + Storage | tout supprimé (0 restant) — **PASS** |
| RLS couverture | 16 tables | RLS activé sur toutes — **PASS** |
| Buckets | 5 buckets (property-documents, property-photos, expense-receipts, profile-avatars, maintenance-files) | tous privés (public=false) — **PASS** |

## Vérifications par inspection

- **Calculs financiers** (`src/lib/finance.ts`) : sélecteurs purs depuis les données brutes, aucun stockage en double. yearNet = revenus − dépenses (ex. 1000 − 200 = 800 ✓), grossYield = loyer×12×100/prix (gardé contre /0), occupancy = loués/total, lateCount = statut « retard ». Formules correctes.
- **Source de vérité unique** : `subscriptions` (via resolvePlan) côté client (store) ET serveur (plan_of_owner après migration). `profiles.plan` = cache secondaire resynchronisé.
- **Intégrité** : FK `on delete cascade` (properties→loyers/dépenses/docs/photos/travaux, auth.users→profil/abonnement) — pas d'orphelins. `subscriptions.user_id` UNIQUE = un seul abonnement/utilisateur.
- **Sécurité code** : clé secrète Supabase jamais importée en composant client ; admin réservé aux routes serveur. Aucun `href="#"`, aucun bouton sans action, aucun TODO/mock hors mode démo explicite.
- **Marque** : 0 occurrence ImmoPilot/Noviqo restante. TypeScript 0 erreur, ESLint 0 erreur (2 warnings préexistants react-hooks/incompatible-library), build production OK.

## Bug trouvé et corrigé (mission précédente, inclus)

- **Abonnement incohérent entre appareils** (gravité critique) : le client et le trigger SQL `plan_of_owner` lisaient `profiles.plan` alors que serveur/page Abonnement lisaient `subscriptions` → l'ancien plan pouvait rester affiché/appliqué après passage Fondateur. Corrigé : `queries.ts` + `store.tsx` dérivent le plan effectif de `subscriptions` ; migration `20260721090000_subscriptions_single_source.sql` fait de même côté SQL et resynchronise `profiles.plan`.

## Non testable automatiquement (nécessite navigateur/appareils réels)

Responsive iPhone/Android/tablette, mode sombre, rendu e-mails mobile, upload via UI,
parcours onboarding visuel, graphiques. → Checklist manuelle ci-dessous.

## Checklist de test manuel (à cocher sur nireo.fr)

- [ ] Inscription (adresse neuve) → e-mail reçu depuis nireo.fr → lien → /auth/callback
- [ ] Connexion / mauvais mot de passe / mot de passe oublié / réinitialisation
- [ ] « Garder ma session » coché → refresh + fermeture navigateur = toujours connecté
- [ ] Onboarding affiché 1×, non réaffiché après reconnexion
- [ ] Créer logement / locataire / bail / loyer / dépense / travaux / document / photo
- [ ] Dashboard : chiffres = données réelles (loyers, impayés, net annuel)
- [ ] Quota Free (2ᵉ logement bloqué) ; passage plan supérieur → quota étendu
- [ ] Achat Fondateur test → page Bienvenue → Business+ actif sur 2 appareils après reconnexion
- [ ] Paramètres : nom, mot de passe, mode sombre, suppression de compte
- [ ] Déconnexion → pages privées redirigent vers /connexion

## Actions manuelles requises

- **Supabase SQL Editor** : exécuter `supabase/migrations/20260721090000_subscriptions_single_source.sql`.
- **Supabase → Auth → URL Configuration** : Site URL `https://nireo.fr` + Redirect URLs `https://nireo.fr/**`, `https://nireo.fr/auth/callback`.
- **Supabase → Auth → Emails → SMTP** : Sender `bonjour@nireo.fr` (domaine vérifié).
- **Supabase → Auth → Emails → Templates** : coller les 3 fichiers `supabase/email-templates/` (rebrandés Nireo).
- **Vercel → Env** : `NEXT_PUBLIC_SITE_URL=https://nireo.fr` + `EMAIL_FROM*` sur nireo.fr (Production + Preview), puis redéployer.
- **Stripe** : `STRIPE_WEBHOOK_SECRET` en prod (Dashboard → Webhooks) pour renouvellements/annulations automatiques.
