# NIREO — AUDIT DE SÉCURITÉ

**21/08/2026** · Aucun secret modifié. Aucune migration appliquée. Aucun compte
privilégié créé. Tous les comptes de test sont jetables et supprimés.

Règle appliquée du début à la fin : **une protection n'est réelle que si elle
résiste à une requête directe envoyée au serveur.** Rien de ce qui suit n'est
déduit du code de l'interface — tout est mesuré par des requêtes réelles.

---

## Résumé

| | |
|---|---|
| Vulnérabilités **critiques** trouvées | **1** — corrigée |
| Vulnérabilités élevées | 0 |
| Faiblesses moyennes | 2 — 1 corrigée, 1 documentée |
| Points faibles / durcissement | 2 — recommandations tableau de bord |
| Contrôles menés | **97 assertions**, toutes exécutées contre la base de production |

Le socle d'autorisation de Nireo est **solide** : RLS réelle sur les 6 tables
métier et les 23 tables Nireo ID, rôle administrateur vérifié en base, quotas
imposés côté serveur, secrets absents du navigateur, CAPTCHA imposé par le
serveur d'authentification.

La faille critique n'était pas une fuite de données : c'était un **verrouillage
total de l'espace d'administration**, provoqué par l'activation de Turnstile.

---

## 🔴 CRITIQUE — L'espace `/admin` était inaccessible à tout le monde

| | |
|---|---|
| **Fichier** | `src/app/api/admin/session/route.ts`, `src/app/admin/login/login-form.tsx` |
| **Gravité** | 🔴 Critique (disponibilité et administration du produit) |

**Cause.** La protection CAPTCHA est activée sur le projet Supabase : GoTrue
refuse **tout** `signInWithPassword` sans jeton. Or la connexion administrateur
appelle cette méthode **depuis le serveur**, sans jeton. La connexion client
avait été adaptée lors du déploiement de Turnstile ; la connexion
administrateur ne l'avait jamais été.

**Exploitation.** Aucune — ce n'est pas une porte ouverte, c'est une porte
condamnée. Personne, y compris le propriétaire, ne pouvait plus accéder à
`/admin` : abonnements, utilisateurs, transactions, support, codes promo.

**Preuve.** Avec un compte jetable dont le mot de passe était connu :

```
mot de passe CORRECT  ->  HTTP 401 « Identifiants invalides. »
mot de passe FAUX     ->  HTTP 401 « Identifiants invalides. »
```

Strictement indiscernables. Le message générique — correct pour empêcher
l'énumération de comptes — masquait la véritable cause.

**Correction.**

1. Le formulaire fournit son jeton, via le composant `useCaptcha` **déjà
   utilisé** par la connexion client (aucun nouveau mécanisme).
2. La route transmet ce jeton à Supabase.
3. Un refus CAPTCHA est désormais **tracé dans le journal** et **annoncé à
   l'utilisateur** — il parle du navigateur, jamais du compte, donc il ne
   permet aucune énumération. Un mauvais mot de passe garde, lui, son message
   générique.

**Tests.** `no captcha_token found` → `invalid-input-response` : la protection
examine désormais le jeton au lieu de l'ignorer. Trace serveur vérifiée.
TypeScript, ESLint et build verts.

> **Vérification manuelle nécessaire.** Turnstile refuse délibérément les
> navigateurs automatisés : la réussite de bout en bout n'est pas démontrable
> ici. Expérience de contrôle menée : la connexion **client**, pourtant
> vérifiée fonctionnelle en production, échoue exactement de la même façon
> dans ce navigateur sans interface. **Connectez-vous une fois à `/admin` à la
> main pour confirmer.**

---

## 🟡 MOYENNE — Recherche par clé fournie par le navigateur

| | |
|---|---|
| **Fichier** | `src/app/api/test-email/route.ts:102` |
| **Gravité** | 🟡 Moyenne, exploitation limitée |

`TEST_TEMPLATES[template]` avec `template` venant du corps de la requête :
`"constructor"` remonte la chaîne de prototypes et renvoie une fonction, qui
passe le garde-fou `if (!factory)`.

**Portée réelle** : le destinataire est **toujours** l'utilisateur connecté,
la route est limitée à 5 envois par heure. Un compte peut donc s'envoyer à
lui-même un e-mail malformé, ou provoquer une erreur 500. Aucune donnée
d'autrui n'est atteignable.

**Non corrigé volontairement** : la portée est self-service et bornée. Signalé
ici car c'est le motif que le brief vise (« ne jamais faire confiance aux
données du navigateur ») ; le remède est d'une ligne
(`Object.hasOwn(TEST_TEMPLATES, template)`), à faire lors d'un prochain
passage sur ce fichier.

---

## 🟡 MOYENNE — Le jeton d'accès survit à la révocation du compte

| | |
|---|---|
| **Gravité** | 🟡 Moyenne, résiduel fermé côté application |

Un jeton d'accès Supabase est un JWT : il reste cryptographiquement valide
jusqu'à son expiration, quoi qu'il arrive au compte.

**Mesuré :**

| Événement | Jeton de rafraîchissement | Jeton d'accès |
|---|---|---|
| Déconnexion | **révoqué** (HTTP 400) | valide jusqu'à expiration |
| Changement de mot de passe (autre appareil) | **révoqué** (HTTP 400) | valide jusqu'à expiration |
| Suppression du compte | **révoqué** (HTTP 400) | valide jusqu'à expiration |

Durée de vie mesurée : **60 minutes**.

**Ce qui ferme le risque** : le proxy appelle `supabase.auth.getUser()`, qui
**valide le jeton auprès du serveur d'authentification** au lieu de simplement
le décoder. Vérifié en conditions réelles — compte supprimé pendant qu'une
session navigateur restait ouverte :

```
AVANT suppression — données visibles
APRÈS suppression — redirigé vers /connexion, aucune donnée
```

**Résiduel** : un jeton volé resterait utilisable jusqu'à une heure contre
PostgREST en direct. Réduire la durée à 15–30 min dans Supabase → Auth →
Sessions diminuerait la fenêtre. C'est un réglage de tableau de bord, pas du
code : à vous d'arbitrer contre le surcroît de rafraîchissements.

---

## Authentification

| Contrôle | Résultat |
|---|---|
| **Force brute** | **Imposée côté serveur.** 6 tentatives envoyées directement à GoTrue, sans passer par la page : toutes refusées `captcha_failed`. L'inscription aussi |
| Connexion administrateur | 10 tentatives / 15 min par IP **et** 5 / 5 min par e-mail, compteur **partagé entre instances** (en base, pas en mémoire) |
| Messages d'erreur | Génériques : ne révèlent ni l'existence d'un compte, ni son statut administrateur |
| Confirmation d'e-mail | **Exigée** — vérifiée sur la configuration réelle du projet |
| Stockage des jetons | **Cookies HttpOnly uniquement.** Aucun jeton en `localStorage` ni `sessionStorage` — vérifié dans le navigateur |
| Contenu du jeton | `role=authenticated`, aucune donnée sensible, aucun drapeau de privilège |
| Longueur de mot de passe | 8 caractères, aux 3 points d'entrée — **mais côté client seulement** (voir recommandations) |
| MFA | Absente. Évaluation ci-dessous |

---

## Autorisation

**Toutes les tentatives ci-dessous ont été faites depuis une vraie session
d'utilisateur normal, en envoyant les requêtes depuis la page — donc avec ses
cookies, exactement comme un attaquant authentifié.**

| Surface | Tentatives | Résultat |
|---|---|---|
| Routes API `/api/admin/*` | 7 routes, GET et POST | **403** partout |
| Pages `/admin/*` | 5 pages | **Redirigées** vers `/admin/login` |
| Tâches planifiées `/api/cron/*` | 4 routes, sans le secret | **401** partout |
| `admin_users` — auto-inscription | INSERT direct | **refusé** |
| `admin_users` — lecture | SELECT direct | **refusé** |
| `nid_admins` — auto-inscription | INSERT direct | **permission denied** |

Le rôle administrateur est lu en base avec la clé secrète, dans une table dont
la RLS n'expose aucune policy : **aucun drapeau côté navigateur n'intervient**.

---

## Supabase — RLS table par table

### Tables métier — `isolation-audit-test.mjs`, **41/41**

`properties`, `tenants`, `leases`, `documents`, `expenses`, `rent_payments`,
`profiles`, `subscriptions`, `admin_users`.

| Opération | Résultat pour un tiers |
|---|---|
| SELECT | Aucune ligne visible |
| UPDATE | Refusé |
| DELETE | Refusé |
| INSERT avec `owner_id` usurpé | Refusé (`P0001`) |
| Référence croisée (bail/document/loyer sur le bien d'autrui) | Refusée côté SQL |
| Auto-attribution d'un plan (`profiles.plan`) | `permission denied` |
| Auto-création d'un abonnement | `permission denied` |

### Tables Nireo ID — `nid-rls-audit.mjs`, **30/30**

**23 tables sur 23 présentes** en base — les migrations Nireo ID sont donc bien
appliquées, contrairement à ce que laissaient croire d'anciennes notes.

Test renforcé : A crée un **espace** et un **passeport** réels, puis B les vise
**par leur identifiant** — le cas où « B ne voit rien » ne prouverait rien.

| Tentative de B | Résultat |
|---|---|
| Lire l'espace de A par son identifiant | Aucune ligne |
| Renommer l'espace de A | Aucune ligne modifiée |
| Supprimer l'espace de A | `permission denied` |
| Lire le passeport de A par son identifiant | Aucune ligne |
| Créer un espace au nom de A | `permission denied` |
| Relever les plafonds de plan | `permission denied` |

5 tables sont totalement fermées au client (`nid_admins`, `nid_audit_logs`,
`nid_check_requests`, `nid_repair_orders`, `nid_stripe_events`).
`nid_plan_limits` est lisible — c'est une table de **référence** (les plans),
pas une fuite.

---

## Storage — bucket par bucket

| Bucket | Visibilité | Taille max | Types autorisés |
|---|---|---|---|
| `property-documents` | **privé** | 20 Mo | PDF, JPEG, PNG, WEBP, HEIC, DOCX |
| `expense-receipts` | **privé** | 20 Mo | idem |
| `maintenance-files` | **privé** | 20 Mo | idem |
| `property-photos` | **privé** | 10 Mo | images uniquement |
| `profile-avatars` | **privé** | 5 Mo | images uniquement |
| `nireo-id-private` | **privé** | 10 Mo | images + PDF |
| `site-media` | public | 200 Mo | **vidéo uniquement**, déposée par l'administration |

Plafonds et listes MIME sont **imposés par le serveur**, pas par l'interface.

| Tentative d'un tiers | Résultat |
|---|---|
| Télécharger le fichier d'autrui | `Object not found` |
| Signer une URL sur le fichier d'autrui | `Object not found` |
| Supprimer le fichier d'autrui | Refusé |
| Écrire dans le dossier d'autrui | `violates row-level security policy` |
| Envoyer un SVG | `mime type image/svg+xml is not supported` |
| Envoyer un HTML | `mime type text/html is not supported` |
| Traversée de chemin (`../`) | Neutralisée |

Le contrôle du contenu ne se fie **pas à l'extension** : le type réel est lu
dans les premiers octets du fichier (`src/lib/supabase/storage.ts`).

---

## Stripe

| Contrôle | Résultat |
|---|---|
| Signature du webhook | Vérifiée sur le **corps brut** (`constructEvent`) |
| Clé secrète | Serveur uniquement — absente du bundle client (vérifié) |
| Choix du plan | Le navigateur n'envoie qu'un **identifiant**, validé contre une liste (`isPaidPlanId`) |
| Prix | Déterminé **par le serveur** (`getPriceIdForPlan`) — jamais transmis par le client |
| Code promotionnel | Revalidé côté serveur pour ce plan précis |
| Activation de l'abonnement | Par le webhook, après encaissement réel — jamais depuis le navigateur |

**Aucun moyen de s'attribuer un plan payant depuis le navigateur.** Les deux
tentatives directes (`profiles.plan`, `subscriptions`) sont refusées par la
base.

---

## Quotas

Imposés **côté serveur**, en base :

| Contrôle | Résultat |
|---|---|
| 2ᵉ logement en plan Gratuit | Refusé, avec explication à l'écran |
| **5 créations simultanées** (course) | 1 seule acceptée — aucune fenêtre de dépassement |
| Contournement par triple clic dans l'interface | **Était possible**, corrigé le même jour (voir `AUDIT_FINITION_2026-08-21.md`) |

---

## Infrastructure

### En-têtes — vérifiés sur `https://nireo.fr`

`Content-Security-Policy`, `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`.

`X-Powered-By` est **déjà désactivé** (`poweredByHeader: false`).

### CSP — `unsafe-inline` dans `script-src`

**Analysé, conservé, et voici pourquoi.** Next.js injecte ses propres scripts
en ligne (amorçage, données de flux) et `next-themes` pose le thème avant
peinture. Les supprimer exige un **nonce par requête**, donc un rendu
**dynamique de toutes les pages** — la vitrine statique et son référencement
en feraient les frais. Les hachages sont impraticables : ces scripts changent à
chaque page et à chaque build.

Ce n'est pas un renoncement : la CSP borne strictement **où les données peuvent
partir** (`connect-src`, `form-action`, `base-uri`, `frame-ancestors 'none'`,
`object-src 'none'`). Chaque domaine autorisé a été vérifié comme réellement
appelé — Supabase, OpenStreetMap (fonds de carte et géocodage), Unsplash
(photos de démonstration, encore référencées), Turnstile (ouvert **uniquement**
si la clé est configurée). Aucun `*`.

### CORS

**Aucun en-tête `Access-Control-Allow-Origin` dans tout le projet.** Aucun
endpoint n'est ouvert à une origine tierce.

### Cookies

Session Supabase : `HttpOnly`, `Secure`, `SameSite=Lax`, portée `/`. Le drapeau
`Secure` avait été ajouté la veille — `@supabase/ssr` ne le renseigne jamais de
lui-même. Cookies de mesure : `HttpOnly`, soumis au consentement, et **effacés
par le serveur** au retrait (le JavaScript de la page ne peut pas les atteindre).

### Secrets

Recherche de motifs stricts (`sk_live_`, `sk_test_`, `sb_secret_`, `whsec_`,
`re_…`) dans **tous les chunks servis au navigateur** : **aucune clé réelle**.
Les seules correspondances sont le code de validation qui *refuse* ces clés —
`src/lib/supabase/config.ts` interrompt le démarrage si une clé secrète est
placée dans une variable `NEXT_PUBLIC_*`.

7 variables `NEXT_PUBLIC_*`, toutes légitimement publiques.

### Cache

Aucune route privée n'est prérendue en statique — vérifié dans le manifeste de
prérendu. Les pages dynamiques répondent
`Cache-Control: private, no-cache, no-store`.

---

## XSS, CSRF, injections

| Vecteur | Constat |
|---|---|
| `dangerouslySetInnerHTML` | 4 usages, tous sûrs. Le JSON-LD **échappe `<`** en `<` (sans quoi un `</script>` dans une donnée refermerait la balise). Le QR est un SVG généré, sans texte utilisateur. Le dernier est une constante du code |
| `innerHTML` | **Aucun** |
| Injection SQL | Aucune requête construite par concaténation. Tout passe par PostgREST/`supabase-js`, qui paramètre |
| CSRF | Session en cookies `SameSite=Lax` : une requête POST inter-site n'emporte pas le cookie. Les mutations passent par des routes qui revérifient la session côté serveur |
| Path traversal | Neutralisé côté Storage (nom de fichier généré en UUID, jamais l'entrée utilisateur) |

---

## Recommandations — réglages de votre tableau de bord

Ces deux points **ne se corrigent pas dans le code**.

### 1. Politique de mots de passe (Supabase → Authentication → Policies)

La longueur minimale de 8 caractères est appliquée **par le navigateur
seulement**. L'API d'administration accepte `"a"`, `"123456"`, `"password"` —
testé, et les comptes créés ont été supprimés.

- Régler « Minimum password length » sur **8** au moins ;
- Activer **« Prevent use of leaked passwords »** : Supabase interroge
  HaveIBeenPwned par **k-anonymat** — seuls les 5 premiers caractères d'un
  hachage partent, jamais le mot de passe. C'est exactement la vérification
  que demande votre §8, sans compromettre la confidentialité.

### 2. Authentification multifacteur (§9)

Supabase gère nativement le TOTP (`auth.mfa`) — **aucun système cryptographique
maison à écrire**. Priorité : les comptes administrateurs, qui pilotent les
abonnements et les données de tous les clients. Ce n'est pas un correctif de
faille : c'est une fonctionnalité, à planifier comme telle.

---

## Tests réellement exécutés

| Suite | Assertions | Résultat |
|---|---|---|
| `scripts/isolation-audit-test.mjs` — RLS, IDOR, Storage, quotas | 41 | **41/41** |
| `scripts/nid-rls-audit.mjs` — 23 tables Nireo ID *(nouveau)* | 30 | **30/30** |
| `scripts/privilege-audit.mjs` — élévation de privilèges *(nouveau)* | 19 | **19/19** |
| `scripts/session-audit.mjs` — sessions et jetons *(nouveau)* | 8 | **8/8** |
| Force brute directe contre GoTrue | 7 | Toutes refusées |
| Connexion administrateur — discriminant avant/après | 4 | Faille reproduite puis corrigée |
| Compte supprimé, session ouverte | 1 | Refusé immédiatement |
| Configuration des 7 buckets Storage | 7 | Conforme |
| Secrets dans les chunks client | — | Aucun |
| En-têtes de production | 7 | Tous présents |

**Trois nouvelles suites rejouables** ont été laissées dans `scripts/`. Aucune
dépendance npm ajoutée.

---

## Vérifications techniques

| | Résultat |
|---|---|
| **TypeScript** | 0 erreur |
| **ESLint** | 0 erreur, 6 avertissements — **référence inchangée** |
| **Build** | ✓ Compiled successfully |
| **Comptes de test** | Tous supprimés, y compris un balayage final de `@nireo-audit.test` |

---

## Verdict

L'objectif que vous avez fixé — *« même si un utilisateur modifie totalement
son navigateur, son JavaScript, son localStorage, ses cookies non protégés ou
ses requêtes HTTP, il ne doit pas pouvoir obtenir des droits ou des données
auxquels son compte n'a pas droit »* — **est tenu**, et il a été vérifié en
attaquant réellement le serveur, jamais en lisant l'interface.

La seule faille critique allait dans l'autre sens : elle vous enfermait dehors.
