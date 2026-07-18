# ImmoPilot — préparation production

## Terminé
- **Blocker corrigé** : `next/image` n'autorisait pas `*.supabase.co` → photos cassées en prod. Ajouté.
- Headers de sécurité (nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy) dans `next.config.ts`.
- `NEXT_PUBLIC_SITE_URL` : centralisée (déjà), **obligatoire en build Vercel production** (échec clair sinon) ; ajoutée à `.env.local` ; `NEXT_PUBLIC_APP_ENV` dans `.env.example`.
- Pages `not-found.tsx` + `error.tsx` (boundary globale, messages FR, bouton Réessayer réel).
- Logger central `src/lib/logger.ts` (point de branchement Sentry unique) — routes Stripe branchées.
- Upload : allowlist d'extensions + limite 20 Mo (chemins déjà UUID, URLs signées 1 h).
- `engines.node >= 20` ; `.env*` ignoré par git, aucun fichier secret suivi (vérifié).
- `DEPLOYMENT.md` : 10 étapes Vercel + URLs Supabase + checklist Stripe + monitoring.
- Auth : redirections basées sur l'origine (compatibles previews/domaine) ; routes privées protégées côté serveur (proxy, re-testé étape 5) ; RLS vérifiée sur les 9 tables (anon bloqué, policies par owner_id).

## Restant (non bloquant pour un premier déploiement)
- Test d'isolation RLS runtime à 2 comptes réels.
- Pagination des longues listes (paiements, documents, dépenses…).
- Tests responsive sur appareils réels.
- Compléter les pages légales (zones [À compléter]) avant commercialisation.
- SMTP personnalisé (optionnel, aucun changement de code requis).

## Actions manuelles (comptes/clés nécessaires)
Suivre `DEPLOYMENT.md` : GitHub→Vercel, variables d'env, URLs Supabase, domaine, puis Stripe.

## Prochaine action exacte
Pousser sur GitHub → importer dans Vercel → suivre DEPLOYMENT.md étapes 3-9.
