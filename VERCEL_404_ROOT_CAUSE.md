# VERCEL_404_ROOT_CAUSE — 2026-07-18

## Verdict
**VERCEL PROJECT/ALIAS ISSUE CONFIRMED** (le code et le dépôt sont hors de cause)
→ STILL BLOCKED — NEEDS VERCEL DASHBOARD ACTION.

## Preuves

### 1. Le dépôt distant est complet (vérifié sur origin/main, pas en local)
`git cat-file` sur `origin/main` (= local, aucune divergence) : `package.json`
(scripts build/start corrects, next 16.2.10, un seul package.json),
`package-lock.json` (lockfileVersion 3, synchronisé), `next.config.ts`,
`tsconfig.json`, `src/app/layout.tsx`, `src/app/(app)/page.tsx` (la page `/`
vit dans le groupe de routes `(app)` — valide), `(public)/accueil`,
`(auth)/inscription`, `src/proxy.ts`, `public/`. Pas de `.vercelignore`,
`.gitignore` n'exclut rien d'essentiel, aucun doublon de casse
(`git ls-files | sort -f | uniq -di` vide), aucun chemin Windows.

### 2. Le build local sert réellement les pages (npm run build + next start)
Build exit 0, puis en production locale : `GET /` **200**, `/inscription`
**200**, `/connexion` **200**, `/api/health` **200** (`{"ok":true}`).
Aucune config 404-gène : pas de `basePath`, `assetPrefix`, `trailingSlash`,
`output: export`, `redirects()` ni `rewrites()` ; `vercel.json` = crons
uniquement ; le proxy n'intercepte pas `/api` et sert `/` (rewrite interne
vers `/accueil` pour les visiteurs).

### 3. Le déploiement aliasé sur imoooo.vercel.app n'est PAS l'app Next
- `https://imoooo.vercel.app/*` → 404 `X-Vercel-Error: NOT_FOUND`, page
  TEXTE de la plateforme Vercel (`fra1::…`), pour TOUTES les routes, y
  compris `/favicon.ico` et `/robots.txt` (fichiers statiques purs).
- Un déploiement Next.js réussi ne peut pas produire cela : il servirait la
  page 404 française stylée de l'app, jamais l'erreur plateforme partout.
- `https://immopilot.vercel.app` → `DEPLOYMENT_NOT_FOUND` (domaine attaché à
  aucun projet).

Conclusion : le déploiement « Ready » derrière imoooo.vercel.app a été
construit **sans framework Next.js** (preset « Other », commande/dossier de
sortie overridés, ou domaine rattaché à un ancien projet vide). « Ready »
signifie que Vercel a terminé, pas qu'un site a été produit.

## Actions manuelles Vercel (dans l'ordre)
1. Ouvrir le déploiement Ready → onglet **Build Logs** : s'il n'affiche PAS
   « Detected Next.js » ni le tableau des routes, le preset est faux.
2. **Settings → Build & Deployment** : Framework Preset = **Next.js** ;
   Build/Install/Output Command et Output Directory : **aucun override**
   (tous décochés) ; Root Directory vide ; Node.js 22.x.
3. **Settings → Domains** : vérifier que `imoooo.vercel.app` est bien
   rattaché à CE projet (celui connecté à rynrzd/imoooo, branche main).
   S'il existe un second projet listant ce domaine, détacher le domaine de
   l'ancien projet (Domains → Remove) — ne supprimer un projet qu'après
   avoir vérifié qu'il n'a aucun déploiement utile.
4. **Deployments → Redeploy** du dernier commit (sans cache de build).
5. Test de vérité : `https://imoooo.vercel.app/api/health` doit répondre
   `{"ok":true,"service":"immopilot"}` — cette route (ajoutée, sans aucune
   dépendance) prouve que le routing Next est servi.

## Fichiers modifiés
- `src/app/api/health/route.ts` (nouveau) : sonde de vie sans Supabase.
- Ce rapport. Rien d'autre — aucun correctif code n'est justifié par les preuves.
