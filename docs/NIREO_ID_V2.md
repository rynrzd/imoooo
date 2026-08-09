# Nireo ID V2 — mise en service

Nireo ID est le **second produit** de la marque Nireo : le suivi simple et
permanent d'un téléphone, créé dès son achat, mis à jour par des bilans
réguliers, enrichi après chaque réparation et transmis avec l'appareil.

> **Promesse affichée :** « Le suivi simple de votre téléphone. »
> **Sous-texte :** « Facture, état et réparations au même endroit. »

Ce document décrit la **V2**. La V1 reste décrite dans
[`NIREO_ID.md`](./NIREO_ID.md) : sa migration n'a pas été modifiée et reste
la base du schéma.

---

## 1. Ce que couvre la V2

| Besoin | Où | Statut |
| --- | --- | --- |
| Espace personnel, entreprise, atelier (compte unique) | `nid_workspaces`, `/id/app`, `/id/entreprise/[id]`, `/id/pro` | Implémenté |
| Rôles owner / admin / manager / member / viewer | `nid_workspace_members` + RLS | Implémenté |
| Invitations (jeton haché, expirant) | `nid_workspace_invites`, `/id/invitation/[token]` | Implémenté |
| Affectation d'un téléphone à un détenteur | `nid_assignments` | Implémenté |
| Bilans : planification, envoi, réponse à jeton | `nid_check_schedules`, `nid_check_requests`, `nid_checkups` | Implémenté |
| Campagnes de bilan d'entreprise | `nid_check_campaigns` | Implémenté |
| Réparations et accès temporaire de l'atelier | `nid_repair_orders`, `/id/reparation/[token]` | Implémenté |
| Provenance explicite de chaque événement | `nid_events.source_type` | Implémenté |
| Import CSV avec aperçu, doublons et rapport d'erreurs | `/id/entreprise/[id]/import` | Implémenté |
| Offres et quotas Nireo ID (indépendants de Nireo Immo) | `nid_plan_limits`, `src/features/nireo-id/plans.ts` | Implémenté |
| Paiement Stripe Nireo ID | `/api/nireo-id/stripe/*` | Implémenté, **inactif tant que les Price IDs ne sont pas renseignés** |

---

## 2. Routes

### Public

| Route | Rôle |
| --- | --- |
| `/id` | Vitrine (hero, fonctionnement, publics, confidentialité, tarifs, FAQ) |
| `/id/bilan/[token]` | Réponse à un bilan, **sans reconnexion** tant que le jeton est valide |
| `/id/reparation/[token]` | Lien remis à l'atelier (compte Nireo requis, aucun abonnement) |
| `/id/invitation/[token]` | Acceptation d'une invitation à un espace |
| `/id/s/[token]` | Rapport partagé (provenances, expiration, aucune donnée sensible) |
| `/id/p/[publicId]` | Aperçu public minimal |

### Espace personnel

`/id/app` (accueil) · `/id/app/telephones` · `/id/app/activite` ·
`/id/app/partages` · `/id/app/parametres` · `/id/app/abonnement` ·
`/id/app/bienvenue` (« Que souhaitez-vous faire aujourd'hui ? ») ·
`/id/app/espaces/nouveau` · `/id/app/objets/[id]` (fiche : Résumé, Historique,
Documents, Partage) · `/id/app/objets/nouveau` (ajout en 4 étapes).

### Espace entreprise

`/id/entreprise/[id]` (vue d'ensemble) · `/parc` · `/affectations` ·
`/bilans` · `/reparations` · `/collaborateurs` · `/rapports` · `/import`.

### Espace atelier

`/id/pro` (tableau des interventions) · `/id/pro/interventions/[id]` ·
`/id/pro/candidature` · `/id/pro/objets/[id]`.

### Administration interne

`/id/admin` (candidatures, signalements, journal) — **strictement séparée**
de `/admin` (Nireo Immo) : `nid_admins` ≠ `admin_users`.

---

## 3. Migration à appliquer

**Une seule migration nouvelle**, idempotente, qui ne modifie ni ne supprime
aucun objet existant :

```
supabase/migrations/20260809090000_nireo_id_v2.sql
```

⚠️ `20260808090000_nireo_id.sql` (V1) **n'a pas été modifiée** : elle peut
déjà être appliquée en production. La V2 la complète.

Avec la CLI Supabase :

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

Sans la CLI : ouvrez `SQL Editor → New query` dans le dashboard Supabase et
exécutez le **fichier complet**.

### Ce que la migration ajoute

Tables : `nid_workspaces`, `nid_workspace_members`, `nid_workspace_invites`,
`nid_assignments`, `nid_check_schedules`, `nid_check_campaigns`,
`nid_check_requests`, `nid_checkups`, `nid_repair_orders`, `nid_plan_limits`,
`nid_stripe_events`.

Colonnes ajoutées : `nid_assets.workspace_id`, `fleet_status`,
`health_state`, `internal_reference`, `warranty_end`, `eprel_url` ;
`nid_events.source_type`, `workspace_id`.

Fonctions : `nid_ensure_personal_workspace`, `nid_create_workspace`,
`nid_accept_invite`, `nid_check_asset_quota`, `nid_create_asset_v2`,
`nid_assign_asset`, `nid_end_assignment`, `nid_create_check_request`,
`nid_answer_checkup`, `nid_answer_checkup_owner`, `nid_create_repair_order`,
`nid_claim_repair_order`, `nid_submit_repair_order`,
`nid_validate_repair_order`, `nid_share_report`.

Rattrapage non destructif : chaque propriétaire existant reçoit son espace
personnel et ses téléphones y sont rattachés (colonne auparavant `NULL`).

### Vérification après application

```sql
select count(*) from public.nid_workspaces;      -- doit répondre
select plan, max_assets from public.nid_plan_limits order by plan;
select id, workspace_id, fleet_status from public.nid_assets limit 5;
```

---

## 4. RLS — qui voit quoi

| Acteur | Accès |
| --- | --- |
| Particulier | Ses téléphones uniquement (`current_owner_id`) |
| owner / admin / manager / viewer d'un espace | Le parc de **cet** espace |
| member (salarié) | **Uniquement** le téléphone qui lui est affecté |
| Réparateur | **Une** intervention explicitement partagée, limitée dans le temps |
| Nouvel acheteur | Aucun accès avant acceptation du transfert |
| Lien public / partagé | Projection autorisée uniquement (fonction `SECURITY DEFINER`) |
| Administrateur Nireo ID | Droits nécessaires, chaque action sensible auditée |
| Utilisateur Nireo Immo sans droit ID | Aucun privilège |

Défenses appliquées : RLS sur **toutes** les nouvelles tables, privilèges
**colonne par colonne** (le jeton haché d'un bilan et d'une réparation n'est
jamais lisible par le rôle applicatif), fonctions `SECURITY DEFINER` à
`search_path` fixé, écritures sensibles interdites au navigateur.

---

## 5. Variables d'environnement

Aucune variable n'est **obligatoire** en plus de celles de Nireo Immo.

| Variable | Effet si absente |
| --- | --- |
| `NIREO_ID_FINGERPRINT_PEPPER` | Empreintes SHA-256 simples (détection des doublons inchangée) |
| `CRON_SECRET` | La route `/api/cron/nireo-id-checkups` répond **503** : aucun bilan automatique (les bilans manuels restent disponibles) |
| `EMAIL_PROVIDER` + clé + `EMAIL_FROM_*` | **Aucun e-mail n'est envoyé et rien n'est marqué « envoyé »** : l'interface affiche le lien sécurisé à transmettre manuellement |
| `NIREO_ID_STRIPE_PRICE_FAMILLE` | L'offre Famille affiche « Bientôt disponible » |
| `NIREO_ID_STRIPE_PRICE_ENTREPRISE_STARTER` | Idem pour Entreprise Starter |
| `NIREO_ID_STRIPE_PRICE_ENTREPRISE_EQUIPE` | Idem pour Entreprise Équipe |
| `NIREO_ID_STRIPE_PRICE_ATELIER_PRO` | Idem pour Atelier Pro |
| `NIREO_ID_STRIPE_WEBHOOK_SECRET` | Le webhook Nireo ID répond **503** : aucun plan payant activé |

Toutes sont listées dans [`.env.example`](../.env.example).

---

## 6. Configuration des e-mails

Nireo ID réutilise le fournisseur de Nireo Immo
(`src/lib/email/provider.ts` : Resend, Brevo ou Postmark).

Modèles Nireo ID : bilan périodique, invitation d'espace, lien d'intervention
remis à l'atelier, réparation soumise, réparation validée, problème déclaré,
demande de transfert, décision sur une candidature professionnelle.

**Règle absolue** : si `EMAIL_PROVIDER` (ou la clé) est absent, la demande
passe en statut `manuel`, `sent_at` reste `NULL`, et l'interface affiche le
lien à transmettre. Aucun succès n'est simulé.

---

## 7. Configuration du cron

Route : `/api/cron/nireo-id-checkups` (GET et POST), en-tête
`Authorization: Bearer ${CRON_SECRET}`.

Planification Vercel (déjà déclarée dans [`vercel.json`](../vercel.json)) :

```json
{ "path": "/api/cron/nireo-id-checkups", "schedule": "0 8 * * *" }
```

Test manuel :

```bash
curl -X POST https://<domaine>/api/cron/nireo-id-checkups \
  -H "Authorization: Bearer $CRON_SECRET"
```

Réponse : `{ due, created, sent, manual, skipped, email_provider }`.

**Idempotence** : l'index unique `nid_check_requests (asset_id, due_on)
where revoked_at is null` garantit qu'une échéance ne génère jamais deux
demandes — relancer le cron n'envoie aucun doublon.

---

## 8. Configuration Stripe (Nireo ID)

Les abonnements Nireo ID et Nireo Immo sont **indépendants** : Price IDs
distincts, endpoint webhook distinct, aucun droit croisé, aucun code promo
Immo appliqué à ID.

1. **Créer 4 produits** dans Stripe (Products → Add product) :

| Offre | Tarif | Variable |
| --- | --- | --- |
| Famille | 29 € / an | `NIREO_ID_STRIPE_PRICE_FAMILLE` |
| Entreprise Starter | 19 € / mois | `NIREO_ID_STRIPE_PRICE_ENTREPRISE_STARTER` |
| Entreprise Équipe | 49 € / mois | `NIREO_ID_STRIPE_PRICE_ENTREPRISE_EQUIPE` |
| Atelier Pro | 29 € / mois / établissement | `NIREO_ID_STRIPE_PRICE_ATELIER_PRO` |

2. **Créer le webhook** : Developers → Webhooks → endpoint
   `https://<domaine>/api/nireo-id/stripe/webhook`, événements
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copier le secret dans
   `NIREO_ID_STRIPE_WEBHOOK_SECRET`.

3. Refaire l'opération en **test** puis en **live** : ne jamais laisser un
   Price ID de test en production.

Garanties du code : la signature est toujours vérifiée ; un plan payant
n'est activé que si l'abonnement Stripe est réellement `active` ou
`trialing` (revérifié auprès de l'API) ; chaque événement n'est traité
qu'une fois (`nid_stripe_events`) ; une annulation ou un impayé ramène
l'espace à l'offre gratuite correspondante.

---

## 9. Premier administrateur Nireo ID

Inchangé depuis la V1 : `supabase/creer_admin_nireo_id.sql` (remplacer
l'adresse e-mail, exécuter dans le SQL Editor). Être propriétaire d'une
entreprise ou réparateur ne donne **jamais** accès à `/id/admin`.

---

## 10. Exécuter les tests

```bash
node scripts/nireo-id-test.mjs      # V1 : RLS, partage, transfert, professionnels
node scripts/nireo-id-v2-test.mjs   # V2 : espaces, affectations, bilans, réparations, quotas
npx eslint src
npx tsc --noEmit
npm run build
```

Les deux scripts créent des comptes jetables et **suppriment tout** à la fin.
Ils exigent que les migrations correspondantes soient appliquées : sans
cela, ils s'arrêtent avec un message explicite (code de sortie 2).

---

## 11. Limites réelles du produit

Elles sont assumées et écrites dans l'interface :

- **aucune vérification officielle des téléphones volés** — « Déclaré volé »
  signifie déclaré par l'utilisateur ou l'entreprise, rien d'autre ;
- **aucune certification d'authenticité** — Nireo n'affiche jamais
  « vérifié / certifié / authentifié par Nireo », seulement la provenance ;
- **aucune lecture automatique universelle de l'IMEI** — une application web
  n'y a pas accès ; le scan lit un code (boîte, étiquette) et l'utilisateur
  confirme toujours ;
- **aucune extraction automatique de facture** — aucun OCR n'est branché :
  le document est stocké, les champs sont saisis à côté ;
- **étiquette européenne (EPREL)** : seule l'URL officielle est conservée,
  aucune caractéristique n'est inventée ;
- **aucune surveillance de l'usage du salarié** — ni appels, ni messages, ni
  position, ni applications, ni temps d'écran ;
- **aucun diagnostic automatique** tant qu'un vrai module n'est pas branché ;
- **aucun e-mail simulé**, **aucun paiement simulé** ;
- **smartphones uniquement** dans l'interface du MVP.

---

## 12. Retour en arrière (non destructif)

La migration V2 n'efface rien. Pour neutraliser la V2 sans perdre de
données :

```sql
-- 1. Arrêter les bilans automatiques (aucune donnée supprimée).
update public.nid_check_schedules set enabled = false;

-- 2. Retirer la planification cron : supprimer la ligne
--    /api/cron/nireo-id-checkups de vercel.json, puis redéployer.

-- 3. Désactiver le paiement Nireo ID : vider les variables
--    NIREO_ID_STRIPE_PRICE_* et NIREO_ID_STRIPE_WEBHOOK_SECRET.
--    Les routes répondent alors 503, aucun compte n'est marqué payant.
```

Les tables `nid_*` V2 peuvent rester en place sans effet : l'application V1
ne les lit pas. **Ne supprimez pas** `nid_assets.workspace_id` : la colonne
est renseignée pour les téléphones existants et son retrait casserait les
policies ajoutées.
