# QA bêta — 2026-07-16

Méthode : PASS = vérifié réellement (HTTP/API/analyse exécutée) · FAIL = bug · BLOCKED = nécessite navigateur/boîte mail/2 comptes confirmés.

## Landing page
- `/` s'ouvre sur le Hero (HTML vérifié, ordre des sections confirmé) — PASS
- Liens header/footer/CTA (fonctionnalités, tarifs, FAQ, contact, légal, auth) → routes 200 — PASS
- Aucun `href="#"`, aucune route inexistante, aucun faux checkout (grille → /inscription, Business → /contact) — PASS
- Anchors + scroll-mt sticky — PASS (code) / rendu visuel navigateur — BLOCKED

## Inscription / confirmation / connexion (API Supabase réelle)
- Inscription nouvelle adresse → compte créé + e-mail de confirmation envoyé — PASS
- Login avant confirmation → refusé (`email_not_confirmed`) — PASS
- Mauvais mot de passe → `invalid_credentials` — PASS
- Mot de passe faible → `weak_password` (422) — PASS
- Rate-limit e-mails (anti-abus) → 429 — PASS
- Mot de passe oublié → envoi accepté (200) — PASS
- Clic sur le lien de confirmation + retour app — BLOCKED (boîte mail)
- Session persistante / reconnexion — BLOCKED (navigateur)

## Routes protégées
- Routes privées anonymes → 307 vers /connexion?next=… (logements, loyers, paramètres, abonnement) — PASS
- Pages publiques accessibles sans session (tarifs, contact, légal, sitemap, robots) — PASS
- 404 connectée (not-found FR) — PASS (build) / anonyme : redirigée vers connexion — PASS (comportement voulu)

## Profil / abonnement / limites
- Trigger création profil + plan free par défaut — PASS (SQL appliqué, vérifié étape 2)
- Ligne `subscriptions` — **FAIL (P1)** : table absente du projet distant (migrations 20260716* non exécutées)
- Limite 1 logement (plan Free) côté serveur — **FAIL (P1)** : trigger non appliqué (même cause)
- Limite côté client (message FR avant insert) — PASS (code vérifié, garde store)
- Essentiel/Pro sans Stripe → checkout 503 « pas encore disponible » — PASS (route vérifiée)
- Business → /contact — PASS

## Sécurité multi-utilisateurs
- Anonyme : lecture = `[]`, écriture = 401/42501 sur les 9 tables — PASS (testé)
- RLS policies owner_id/auth.uid() sur SELECT/INSERT/UPDATE/DELETE — PASS (SQL inspecté)
- Test runtime croisé compte A ↔ B (URL directe, documents, photos) — BLOCKED (2 comptes confirmés requis)

## Modules métier (logements, locataires, baux, loyers, dépenses, travaux, documents, photos)
- Schéma/requêtes/mutations alignés, contraintes (bail actif unique/logement, unique loyer/mois) — PASS (vérifié étapes 2-3)
- Upload : extensions autorisées + 20 Mo max + chemin UUID privé — PASS (code)
- Parcours UI complets (création → modification → suppression → actualisation) — BLOCKED (navigateur)
- Pagination loyers/documents/photos — PASS (code + build) / interaction — BLOCKED

## Dashboard / statistiques
- Calculs centralisés (finance.ts/insights.ts), gardes NaN/division 0 (rendement, occupation, encaissement) — PASS (code vérifié + bug corrigé étape 3)
- Rendu avec compte vide/rempli — BLOCKED (session navigateur)

## Paramètres
- Profil (nom/téléphone) persiste en base, e-mail lecture seule, mot de passe réel, exports JSON/CSV réels — PASS (code, corrigé étape 3)
- Chargement : store global unique (pas de rechargement par page) — PASS (architecture)

## Responsive (1440/1024/768/390)
- Grilles 1 colonne mobile, menu hamburger, comparaison plans en accordéon, tableaux scrollables — PASS (code)
- Vérification visuelle par viewport — BLOCKED (navigateur)

## Réseau lent / erreurs
- Loading/erreur/retry par page, erreurs FR, error boundary + not-found globales — PASS (code + build)
- Simulation réseau lent/upload interrompu — BLOCKED

## Technique
- TypeScript 0 erreur — PASS · Lint 0 erreur (1 warning bénin) — PASS · Build 30 routes — PASS
- `.env*` ignoré par git, aucun secret suivi — PASS · Seed dev séparé (`scripts/seed-dev.mjs`, refuse la prod) — PASS
