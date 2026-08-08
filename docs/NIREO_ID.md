# Nireo ID — mise en service

Nireo ID est le **second produit** de la marque Nireo : l'identité numérique
et l'historique transférable des objets (catégorie du MVP : **smartphones**).
Il vit dans le même dépôt que Nireo Immo, sur des routes et des tables
séparées. Aucune route, table ni policy de Nireo Immo n'a été modifiée.

| | Nireo Immo | Nireo ID |
| --- | --- | --- |
| Vitrine | `/` | `/id` |
| Application | `/` (connecté) | `/id/app` |
| Administration | `/admin` (`admin_users`) | `/id/admin` (`nid_admins`) |
| Tables | `properties`, `tenants`… | `nid_*` |
| Bucket | `property-*` | `nireo-id-private` |

Les deux administrations sont **indépendantes** : être administrateur d'un
produit ne donne aucun droit sur l'autre.

## 1. Appliquer la migration (OBLIGATOIRE)

Le schéma Nireo ID vit dans une seule migration versionnée :
[`supabase/migrations/20260808090000_nireo_id.sql`](../supabase/migrations/20260808090000_nireo_id.sql)
(tables `nid_*`, RLS, privilèges colonne, fonctions atomiques, bucket privé).
Elle est idempotente et ne touche à aucun objet existant.

Avec la CLI Supabase (méthode recommandée, versionnée) :

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

`link` demande votre jeton d'accès Supabase, `db push` le mot de passe de la
base. Sans la CLI, exécutez le **fichier complet** ci-dessus dans
`SQL Editor → New query` du dashboard — comme les migrations précédentes du
projet (voir [`supabase/README.md`](../supabase/README.md)).

Vérification : `Table Editor` doit lister `nid_assets`, `nid_ownerships`,
`nid_events`, `nid_documents`, `nid_media`, `nid_share_links`,
`nid_transfers`, `nid_professional_profiles`, `nid_professional_access`,
`nid_disputes`, `nid_audit_logs`, `nid_admins` — et `Storage` le bucket
privé `nireo-id-private`.

## 2. Créer le premier administrateur Nireo ID

```sql
-- supabase/creer_admin_nireo_id.sql (remplacez l'adresse e-mail)
```

Exécutez [`supabase/creer_admin_nireo_id.sql`](../supabase/creer_admin_nireo_id.sql)
dans le SQL Editor. Le compte doit déjà exister dans Supabase Auth.
Sans cette étape, `/id/admin` renvoie tout le monde vers `/id/app` : aucune
candidature professionnelle ne peut être approuvée.

## 3. Vérifier

```bash
node scripts/nireo-id-test.mjs
```

Le script crée quatre comptes jetables (propriétaire, acheteur,
professionnel, administrateur), déroule les parcours critiques puis supprime
tout. Il couvre l'isolation RLS entre utilisateurs, les privilèges colonne,
l'absence de fuite dans l'aperçu public, les liens de partage (valide,
expiré, révoqué), le transfert atomique et la double acceptation, le refus
d'un compte professionnel non approuvé, l'accès professionnel, le journal
append-only et les droits d'administration.

Il sort en code `2` avec un message explicite tant que la migration n'est pas
appliquée.

## 4. Variables d'environnement

Nireo ID **n'exige aucune variable supplémentaire** : il réutilise Supabase,
l'authentification et le fournisseur e-mail existants.

- `NIREO_ID_FINGERPRINT_PEPPER` *(facultatif, serveur)* — poivre des
  empreintes de numéro de série / IMEI utilisées pour détecter les doublons.
  À fixer **une fois pour toutes** : le modifier rend les empreintes déjà
  enregistrées incomparables.

Sans fournisseur e-mail configuré (`EMAIL_PROVIDER` + clé), **aucun envoi
n'est simulé** : l'interface affiche le lien d'invitation à transmettre
soi-même et le dit explicitement.

## 5. Ce que le produit ne fait pas

Ces limites sont écrites dans l'interface, pas seulement ici :

- aucun contrôle d'appareil déclaré volé (aucune source officielle branchée) ;
- aucune certification d'authenticité ; la mention « vérifié par Nireo » est
  **interdite** tant qu'aucun protocole de contrôle Nireo n'existe ;
- aucun paiement, aucune blockchain, aucune API publique ;
- l'interface ne propose que les smartphones (le modèle de données reste
  extensible : `nid_assets.category`).
