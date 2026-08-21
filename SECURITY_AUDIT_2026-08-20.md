# SECURITY AUDIT — NIREO

**Date** : 20/08/2026 · **Périmètre** : Nireo Immo + Nireo ID + espace admin + espace partenaire
**Cible testée** : base Supabase de **production** (lecture + comptes jetables) et `https://nireo.fr` en ligne
**Rien n'a été commité ni poussé. Aucun secret réel n'a été modifié.**

## Score global

# 93 / 100

| Catégorie | Score | Risque résiduel |
|---|---|---|
| Authentication | 95 | Faible |
| Authorization (IDOR, escalade) | 98 | Très faible |
| Database / RLS | 98 | Très faible |
| Storage / uploads | 95 | Très faible |
| API / Server Actions | 92 | Faible |
| Payments (Stripe) | 95 | Très faible |
| Admin | 95 | Très faible |
| Frontend / XSS | 88 | Faible |
| Headers / CSP | 90 | Faible |
| Secrets | 85 | Moyen *(opérationnel, hors code)* |
| Dependencies | 90 | Faible *(70 avant correctif)* |
| Business logic | 95 | Très faible |
| Privacy / RGPD | 92 | Faible |

---

## Ce qui a réellement été prouvé

L'objectif énoncé — « deux utilisateurs ne peuvent jamais accéder aux données de
l'autre, personne ne s'élève en privilèges, personne ne contourne les quotas » —
a été **testé, pas supposé**, contre la base de production, avec deux vraies
sessions utilisateur.

**41 assertions, 41 PASS.** Rejouable : `node scripts/isolation-audit-test.mjs`
(comptes jetables `@nireo-audit.test`, supprimés en fin de test).

| Attaque tentée par l'utilisateur B | Résultat |
|---|---|
| Lire properties / tenants / leases / documents / expenses / rent_payments de A par leur `id` | 0 ligne |
| Lire le profil et l'abonnement de A | 0 ligne |
| Modifier / supprimer chacune des 6 tables de A | 0 ligne touchée |
| Insérer avec `owner_id` = A | Refusé (P0001) |
| Poser un bail sur le logement de A (déni de service ciblé) | Refusé — `enforce_owner_consistency` |
| Rattacher un document / un loyer aux biens de A | Refusé |
| S'attribuer `profiles.plan = business` | `permission denied` |
| Modifier `subscriptions` (plan, statut) | `permission denied` |
| S'insérer dans `admin_users` / lister les admins | Refusé (42501) / 0 ligne |
| Télécharger, signer une URL, supprimer ou écraser un fichier de A | Refusé (`Object not found` / RLS) |
| Déposer un SVG ou un HTML piégé | Refusé par le serveur (type MIME borné) |
| Traversée de chemin `../` vers le dossier de A | Refusé par la RLS |
| Dépasser le quota Free (1 logement) | Refusé |
| **Dépasser le quota par 5 requêtes simultanées** | **1 seule acceptée — aucune course** |

Trois autres vérifications indépendantes :

- **Visiteur anonyme** : introspection PostgREST → **0 table exposée**. 9 tentatives
  d'écriture (properties, profiles, admin_users, subscriptions, promo_codes,
  marketing_partners…) → **9 refus**.
- **En ligne, sans session** : 13 pages privées/admin → 307 ; 18 endpoints API →
  401/403 ; webhook Stripe sans signature → 400. Aucune exception.
- **Bundle JavaScript client** : aucun secret. Les occurrences de `sb_secret_` et
  `whsec_` sont les **littéraux des validateurs** (`startsWith("sb_secret_")`),
  pas des valeurs.

---

## 🔴 Critical

**Aucun.**

## 🟠 High

**Aucun.**

---

## 🟡 Medium

### M1 — Cookie de session posé sans `Secure` ✅ CORRIGÉ

1. **Emplacement** : `src/lib/supabase/client.ts` (`serializeCookie`, `setRememberSession`), `src/lib/supabase/server.ts`, `src/proxy.ts`.
2. **Problème** : `DEFAULT_COOKIE_OPTIONS` de `@supabase/ssr` ne contient **aucune** propriété `secure` — seulement `path`, `sameSite`, `httpOnly`, `maxAge`. Les trois endroits qui écrivent le cookie d'authentification recopiaient ces options telles quelles.
3. **Impact** : le jeton de session (`sb-…-auth-token`, 400 jours) pouvait être transporté en clair. **Mesuré en ligne avant correctif** : `Secure=NON`.
4. **Exploitation** : requête HTTP en clair vers le domaine (première visite, avant que HSTS ne soit épinglé ; ou sous-domaine mal configuré) → capture de la session par un intermédiaire réseau.
5. **Correction** : constante `SECURE_COOKIES` dans `session-persistence.ts`, appliquée aux 3 écrivains. Posée en production seulement — un cookie `Secure` sur `http://localhost` serait ignoré et casserait la connexion en développement.
6. **Effectuée** : oui.
7. **Test de confirmation** : build de production local, vrai flux `/auth/callback` → `Secure=OUI` (identique au test qui donnait `Secure=NON` avant).

### M2 — `shadcn` livré en dépendance de production ✅ CORRIGÉ

1. **Emplacement** : `package.json`, bloc `dependencies`.
2. **Problème** : `shadcn` est un **outil d'échafaudage en ligne de commande**, importé **nulle part** dans `src/`. Il tirait en production `@modelcontextprotocol/sdk`, `hono`, `@hono/node-server`, `undici`, `ip-address`, `fast-uri`, `js-yaml`, `express-rate-limit`.
3. **Impact** : surface d'attaque et exposition à la chaîne d'approvisionnement sans aucune contrepartie. **6 des 8 vulnérabilités npm** venaient de là.
4. **Exploitation** : indirecte — toute compromission d'un de ces paquets atteindrait l'arbre de production.
5. **Correction** : déplacé en `devDependencies` (avec `@types/leaflet`, qui n'a rien à faire en production non plus).
6. **Effectuée** : oui.
7. **Test** : `npm audit --omit=dev` → **8 vulnérabilités ➜ 1**. Build, tsc et lint inchangés.

### M3 — Clés Stripe **live** sur la machine de développement ⚠️ NON CORRIGÉ (décision opérateur)

1. **Emplacement** : `.env.local` (`STRIPE_SECRET_KEY=sk_live_…`), et sa copie intégrale `.env.local.bak-avant-expediteur`.
2. **Problème** : la clé secrète des paiements réels, plus `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, vivent en clair sur un poste de travail — en double.
3. **Impact** : un test local malencontreux touche de vrais paiements ; un poste compromis livre l'ensemble des accès de production.
4. **Exploitation** : vol de fichier, sauvegarde cloud automatique, partage d'écran.
5. **Correction recommandée** : basculer `.env.local` sur les clés **test** Stripe, supprimer le `.bak` (son contenu ne sert plus), et faire tourner les clés si un doute existe.
6. **Effectuée** : **non** — modifier des secrets réels était explicitement hors périmètre.
7. **Test** : `grep -c "sk_live_" .env.local` doit renvoyer 0.

> ✅ Vérifié : les deux fichiers sont **correctement ignorés par Git** (`.env*`) et
> **n'ont jamais été commités** (`git ls-files` ne renvoie que `.env.example`).

---

## 🔵 Low

### L1 — En-têtes d'isolation absents ✅ CORRIGÉ

`Cross-Origin-Opener-Policy: same-origin` ajouté dans `next.config.ts`. Sans
risque fonctionnel : Nireo n'ouvre **aucune fenêtre surgissante** — Stripe
fonctionne par redirection et Turnstile rend son défi dans une iframe, que cette
politique ne concerne pas.
`Cross-Origin-Resource-Policy` volontairement **non posé** : il empêcherait les
robots sociaux de charger `/opengraph-image`, pour un gain nul sur une ressource
déjà publique.
**Test** : `curl -sI https://nireo.fr | grep -i cross-origin`.

### L2 — `X-Powered-By: Next.js` ✅ CORRIGÉ

`poweredByHeader: false`. Ne protège de rien seul, mais rien ne justifiait
d'annoncer le framework.
**Test** : `curl -sI https://nireo.fr | grep -i x-powered-by` → vide.

### L3 — Redirection `next=` : contre-barre acceptée ✅ DURCI

`src/app/auth/callback/route.ts`, `(auth)/connexion/page.tsx`,
`(auth)/inscription/page.tsx`.
La garde était `startsWith("/") && !startsWith("//")`. Les analyseurs d'URL
convertissent `\` en `/`, donc `/\evil.com` peut se relire `//evil.com`.
**J'ai vérifié que ce n'était PAS exploitable** : la reconstruction donne
`https://nireo.fr//evil.com` — l'hôte reste `nireo.fr`. La contre-barre est
néanmoins refusée désormais : une destination de redirection n'a aucune raison
d'être autre chose qu'un chemin, et cette garantie ne doit pas dépendre du détail
d'implémentation d'un analyseur d'URL.
**Test** : `/connexion?next=/\evil.com` doit aboutir sur `/`.

### L4 — Jeton partenaire transmis dans l'URL ⚠️ NON CORRIGÉ

`/partenaire/acces?token=…` : le jeton (256 bits) transite en query string —
historique de navigation, journaux serveur. Atténué : il est immédiatement
échangé contre un cookie `HttpOnly` limité à `/partenaire`, `Referrer-Policy` est
`strict-origin-when-cross-origin`, et l'URL finale ne le porte plus. Le motif est
celui d'un lien magique standard. Amélioration possible (formulaire POST), sans
urgence.

### L5 — Secret de cron comparé sans temps constant ⚠️ NON CORRIGÉ, DÉLIBÉRÉMENT

Les 4 routes `/api/cron/*` font `headers.get("authorization") !== \`Bearer ${secret}\``.
Une attaque temporelle à travers le réseau, Vercel et Node, contre un secret
aléatoire, n'est pas réalisable. Ajouter `timingSafeEqual` ici serait un rituel
sans effet : **je ne l'ai pas fait**, conformément à la consigne de ne pas créer
de fausse sécurité.

### L6 — `nanoid` (high) subsistant ⚠️ NON CORRIGÉ, DÉLIBÉRÉMENT

Chemin : `next@16.3.1 → postcss → nanoid@3.3.16`. La faille exige d'appeler
`customAlphabet` avec `size = 0` ; Nireo n'appelle **jamais** nanoid, et postcss
s'en sert au **moment du build** pour des identifiants de source-map. Forcer un
`overrides` sur une dépendance transitive du build de Next.js ferait baisser un
chiffre sans rien sécuriser. Disparaîtra avec la prochaine version de Next.

---

## ⚪ Informational

### I1 — Cookie de session non `HttpOnly` — limite d'architecture, pas un défaut

`createBrowserClient` de `@supabase/ssr` **doit** lire la session dans
`document.cookie` : `httpOnly: false` est son défaut assumé. Conséquence à
connaître : combinée à `script-src 'unsafe-inline'`, une XSS livrerait la
session. C'est précisément pourquoi la CSP ne doit jamais être relâchée davantage,
et pourquoi `SameSite=Lax` (présent) et `Secure` (désormais présent) comptent.

### I2 — CSP : `script-src 'unsafe-inline'` — arbitrage documenté et légitime

Next.js injecte ses propres scripts en ligne et `next-themes` pose le thème avant
peinture. S'en passer imposerait un nonce par requête, donc un rendu **dynamique
de toutes les pages** — la vitrine statique et son référencement en pâtiraient.
La CSP reste une couche utile : `connect-src`, `form-action` et `base-uri` bornent
strictement **où les données peuvent partir**. L'arbitrage est correct et déjà
écrit dans `next.config.ts`.

### I3 — Rate limiting : mémoire par instance pour la plupart des routes

`checkRateLimit` compte par instance serverless. Les deux surfaces où l'on
**devine un identifiant** — connexion admin, accès partenaire — utilisent bien
`checkRateLimitShared` (compteur SQL commun, `consume_rate_limit` **présente en
production, vérifié**). Pour le reste, la vraie protection est ailleurs
(authentification, RLS, quotas SQL). Dimensionnement correct.

### I4 — Partenaire désactivé : accès conservé

`getAuthenticatedPartner` ne filtre pas `is_active` ; la page affiche un bandeau.
Il ne voit **que ses propres** commissions. Choix produit, pas une faille.

---

## Points restant à traiter

### R1 — Trois pages à jeton sont injoignables sans compte (fonctionnel)

**Je ne l'ai pas corrigé : cela modifierait la portée d'accès publique, ce qui
est votre décision, pas la mienne.**

`/id/bilan/[token]`, `/id/reparation/[token]` et `/id/invitation/[token]` rendent
explicitement une branche anonyme (`session ? … : …`) — elles sont conçues pour
un réparateur ou un invité **sans compte Nireo**. Mais `src/proxy.ts` ne déclare
publics que `/id/exemple`, `/id/p` et `/id/s` :

```
NIREO_ID_PUBLIC_PREFIXES = ["/id/exemple", "/id/p", "/id/s"];
```

**Vérifié en ligne** : les trois répondent `307 → /connexion`. Les liens envoyés
par e-mail ne fonctionnent donc pas pour leur destinataire prévu.

Ce n'est **pas** une vulnérabilité (c'est plus restrictif que prévu), mais c'est
une fonctionnalité morte. Si ces parcours doivent vivre, ajouter
`"/id/bilan", "/id/reparation", "/id/invitation"` à cette liste : la sécurité de
ces pages repose sur le jeton (256 bits, stocké **haché** en SHA-256, expirable et
révocable), pas sur le proxy.

### R2 — M3 : clés `sk_live_` en développement, et `.env.local.bak-avant-expediteur` à supprimer.

### R3 — HSTS à 180 jours sans `preload`

`max-age=15552000; includeSubDomains`. Passer à `31536000` est la valeur
recommandée. Non appliqué : c'est un engagement d'un an sur la disponibilité
HTTPS du domaine et de tous ses sous-domaines — à décider, pas à subir.

---

## Corrections effectuées

| # | Fichier | Changement |
|---|---|---|
| 1 | `src/lib/supabase/session-persistence.ts` | Constante `SECURE_COOKIES` (production uniquement) |
| 2 | `src/lib/supabase/client.ts` | `Secure` sur les cookies Auth + sur `immopilot-remember` |
| 3 | `src/lib/supabase/server.ts` | `Secure` sur l'écriture serveur |
| 4 | `src/proxy.ts` | `Secure` sur le rafraîchissement de session |
| 5 | `package.json` + lockfile | `shadcn` et `@types/leaflet` → `devDependencies` |
| 6 | `next.config.ts` | `Cross-Origin-Opener-Policy: same-origin` |
| 7 | `next.config.ts` | `poweredByHeader: false` |
| 8 | `src/app/auth/callback/route.ts` | Contre-barre refusée dans `next=` |
| 9 | `src/app/(auth)/connexion/page.tsx` | Idem |
| 10 | `src/app/(auth)/inscription/page.tsx` | Idem |
| — | `scripts/isolation-audit-test.mjs` | **Nouveau** — suite d'isolation rejouable (41 assertions) |

Aucun design, composant, route, table ni règle métier n'a été touché.

---

## Tests réalisés

| Test | Résultat |
|---|---|
| Isolation A/B en base de production (41 assertions) | **41/41 PASS** — avant et après correctifs |
| Anonyme : introspection PostgREST | **0 table exposée** |
| Anonyme : 9 écritures sur tables sensibles | **9 refus** |
| En ligne : 13 pages privées / admin sans session | 307 — aucune fuite |
| En ligne : 18 endpoints API sans session | 401 / 403 / 400 — aucune exception |
| Course sur quota (5 insertions simultanées) | 1 acceptée, quota tenu |
| Uploads SVG / HTML / `../` | Refusés **par le serveur** |
| Bundle client : recherche de secrets | Aucun (littéraux de validation uniquement) |
| Git : secrets commités | Aucun (`.env.example` seul) |
| Cookie `Secure` avant / après | `NON` ➜ **`OUI`** |
| En-têtes en ligne vs `next.config.ts` | Identiques — le déploiement est à jour |
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 6 avertissements — *identiques à l'avant-correctifs* |
| `npm run build` | **✓ Compiled successfully in 58s** |
| `npm audit --omit=dev` | 8 ➜ **1** |

**Point de méthode important** : `scripts/rls-test.mjs` et
`scripts/cross-owner-test.mjs` **ne fonctionnent plus** — ils échouent sur
`captcha protection: request disallowed`. Ce n'est pas une panne : **Turnstile
est actif au niveau de Supabase Auth et bloque la connexion par mot de passe
automatisée**, ce qui est exactement le comportement voulu contre la force brute.
La nouvelle suite obtient de vraies sessions via
`admin.auth.admin.generateLink()` + `verifyOtp()`, côté serveur, hors CAPTCHA.

---

## État réel de la base de production (vérifié, non supposé)

Les notes internes annonçaient « 3 migrations en attente ». **C'est faux** : les
trois sont appliquées.

| Contrôle | État |
|---|---|
| RLS activée sur les **57** tables | ✅ |
| Politiques trop permissives (`using (true)`) | 1 seule — `nid_plan_limits`, une grille tarifaire publique. Légitime |
| `20260819100000` limites d'envoi Storage | ✅ appliquée — 5 buckets bornés en taille **et** en type MIME |
| `20260819110000` longueurs de texte | ✅ appliquée — 300 000 caractères refusés (23514) |
| `20260820100000` catégorie `loyers` | ✅ appliquée |
| `consume_rate_limit`, `plan_of_owner`, `confirm_founder_purchase`, `nid_resolve_share`, `nid_public_preview` | ✅ présentes |
| Buckets publics | 1 — `site-media`, **vidéo seulement** (`mp4`/`quicktime`/`webm`) |

---

## Configuration production recommandée

1. **Déployer** — la correction `Secure` n'agit qu'une fois en ligne.
2. **Vercel** : vérifier que `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`,
   `SUPABASE_SECRET_KEY`, `REF_COOKIE_SECRET` et `NEXT_PUBLIC_SITE_URL` sont bien
   définis en *Production* (leur absence dégrade proprement, mais silencieusement).
3. **Stripe** : confirmer que le webhook est abonné à `invoice.paid` **et**
   `charge.refunded`, en test **comme** en live (cause connue du bug
   « aucune commission »).
4. **Poste de développement** : repasser sur les clés Stripe *test*, supprimer
   `.env.local.bak-avant-expediteur`.
5. **Journalisation** : `src/lib/logger.ts` est un point de branchement unique et
   propre, mais **aucun service n'est connecté**. Sans lui, une attaque en cours
   est invisible. C'est le principal manque restant, et il est opérationnel, pas
   applicatif.
6. Trancher R1 (pages à jeton) et R3 (HSTS un an).

---

## Verdict

# ⚠️ READY WITH CONDITIONS

Le cœur du produit est **solide et démontré** : l'isolation entre comptes, la RLS,
les quotas serveur, l'isolation du Storage, l'intégrité Stripe et la séparation
administrateur ne cèdent sur aucun des scénarios testés — y compris ceux qui
cassent le plus souvent (référence croisée entre propriétaires, course sur les
quotas, usurpation d'`owner_id`, envoi de SVG). Ce n'est pas une impression de
lecture : c'est mesuré contre la base réelle.

Les trois conditions avant lancement public sont **le déploiement du correctif
`Secure`**, **la sortie des clés `sk_live_` du poste de développement**, et
**le branchement d'une supervision d'erreurs**. Aucune ne demande de retoucher
l'architecture.

Ce qui empêche le ✅ complet n'est pas une faille : c'est qu'un lancement public
sans journalisation externe vous prive du seul moyen de voir un incident arriver.
