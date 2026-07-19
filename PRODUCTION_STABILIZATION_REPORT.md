# PRODUCTION_STABILIZATION_REPORT — 2026-07-19

## Parcours testés (données Supabase réelles, comptes de test créés puis supprimés)
Sécurité A/B, quotas serveur, activation Stripe réelle (mode test), suppression
de compte, RLS écriture, Storage cross-user, reproduction des bugs connus.

## P0 — aucun trouvé, aucun restant
Isolation multi-utilisateurs vérifiée par appels REST directs (jeton de B contre
les données de A) :
- B lit logement A → 0 ligne · B modifie logement A → 0 ligne · B insère
  owner_id=A → **403** · B lit/écrit subscription A → 0 ligne / **403** ·
  B s'auto-upgrade en business/lifetime → **403** · B s'insère founder confirmé
  → **403** · B lit notifications A → 0 ligne · B upload dans le dossier
  Storage de A → **refusé**. RLS + policies Storage (chemin préfixé user_id) OK.
- Suppression de compte A : user Auth supprimé (404 après), 0 logement, 0
  subscription restants → nettoyage complet vérifié.

## P1 — aucun restant (bugs des missions précédentes confirmés corrigés)
- Quota Free logements appliqué par trigger serveur : 2ᵉ logement → **400**
  « Votre plan permet 1 logement(s) maximum » (non contournable via API directe).
- Activation abonnement : Stripe test Pro → /api/stripe/sync → `plan=pro,
  status=active`, `profiles.plan=pro` ; idempotent, pas de doublon.
- Boucle Checkout : corrigée (param retiré synchronement, garde module, polling
  limité) — vérifié aux missions précédentes.
- Offre Fondateur : checkout serveur (palier calculé serveur), 409 double achat,
  compteur réel intact, plafond 100 par RPC atomique.

## P2 restants (non bloquants)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` présente mais non utilisée (tunnel
  Checkout hébergé) — inoffensif, à retirer éventuellement.
- Responsive/perf/accessibilité : non re-testés visuellement cette session
  (aucune régression de code introduite ; audits antérieurs OK).

## Contrôles techniques
- TypeScript : **0 erreur** · ESLint : **0 erreur** (2 warnings préexistants,
  react-hooks/incompatible-library, hors périmètre) · `npm run build` : **exit 0**.
- Aucun secret suivi par Git, `.env.local` ignoré, aucun chemin Windows codé.
- Variables code ↔ `.env.example` : cohérentes ; convention unique respectée.

## Bloquants NON résolubles par le code (configuration externe — PREUVES)
1. **SMTP Supabase cassé** (reproduit ce jour) : tout signUp → 500
   `unexpected_failure` « Error sending confirmation email », même vers
   gamixrs@gmail.com. La clé Resend de `.env.local` envoie pourtant (testé). →
   Corriger SMTP dans Auth → Emails (AUTH_SETUP.md §5). **Inscription bloquée
   tant que non fait.**
2. **STRIPE_WEBHOOK_SECRET absent** en local (et à confirmer sur Vercel) : sans
   lui, aucun webhook traité → renouvellements/annulations/Fondateur non
   synchronisés automatiquement (le sync au retour de Checkout compense
   l'activation initiale, pas le cycle de vie). → `stripe listen` en local,
   Dashboard → Webhooks en prod.
3. **Vercel ne sert pas l'app** : `imoooo.vercel.app` → DEPLOYMENT_NOT_FOUND.
   Voir VERCEL_404_ROOT_CAUSE.md : preset/alias projet à corriger dans le
   Dashboard (le code build en exit 0 avec variables présentes).

## Configurations externes restantes (à faire manuellement, avec preuve exigée)
- Supabase : SMTP (bloquant), URL Configuration (Redirect URLs local+Vercel),
  templates e-mails, plan Pro avant vraie charge, sauvegardes.
- Stripe : webhook + signing secret, Customer Portal activé, événements requis,
  bascule live le moment venu.
- Resend : domaine vérifié (SPF/DKIM/DMARC) — `onboarding@resend.dev` limité à
  gamixrs@gmail.com ; sender sur domaine vérifié pour de vrais clients.
- Vercel : variables Production+Preview, preset Next.js, domaine sur le bon projet.

## Verdict
**READY WITH MANUAL ACTIONS** — code stable, sécurité/quotas/paiement/suppression
validés en réel ; le lancement dépend de 3 actions externes (SMTP Supabase,
webhook Stripe, déploiement Vercel), aucune n'étant un défaut de code.

## Prochaine action exacte
Corriger le SMTP dans le Dashboard Supabase (Auth → Emails), puis tester
`/inscription` avec gamixrs@gmail.com. Sans cela, aucun client ne peut
s'inscrire — c'est le premier verrou du lancement.
