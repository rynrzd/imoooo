-- =============================================================
-- NIREO ID — identité numérique et historique transférable des objets.
--
-- Deuxième produit de la marque Nireo, TOTALEMENT isolé de Nireo Immo :
-- toutes les tables sont préfixées `nid_`, aucune table ni policy
-- existante n'est modifiée. Catégorie du MVP : smartphone uniquement
-- (le modèle reste extensible : `category` est une colonne contrainte).
--
-- Sécurité (résumé) :
--  • RLS activée sur TOUTES les tables ; le propriétaire courant d'un
--    passeport est la seule identité qui lit/écrit ses données ;
--  • les identifiants privés (numéro de série, IMEI) ne sortent jamais
--    d'une lecture publique : les fonctions publiques ne renvoient que
--    des champs explicitement listés ;
--  • les jetons (partage, transfert) ne sont JAMAIS stockés en clair —
--    seul leur SHA-256 est enregistré ;
--  • les opérations multi-étapes (création, acceptation d'un transfert,
--    intervention professionnelle) sont des fonctions SECURITY DEFINER :
--    tout réussit ou tout est annulé ;
--  • `nid_audit_logs` est append-only (trigger bloquant UPDATE/DELETE) ;
--  • les rôles Nireo ID (`nid_admins`) sont indépendants de `admin_users`
--    (Nireo Immo) : aucun privilège ne traverse d'un produit à l'autre.
--
-- 100 % idempotente. Aucune donnée existante supprimée ni modifiée.
-- =============================================================

begin;

-- =============================================================
-- 1. Administration Nireo ID (séparée de l'admin Nireo Immo)
-- =============================================================

create table if not exists public.nid_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'moderateur')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.nid_admins enable row level security;
-- Aucune policy : table invisible aux clients. Seule la clé secrète y accède.
revoke all on table public.nid_admins from anon, authenticated;

-- =============================================================
-- 2. Comptes professionnels
-- =============================================================

create table if not exists public.nid_professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  trade_name text not null check (char_length(trade_name) between 2 and 120),
  legal_name text not null default '',
  siret text not null default '' check (siret = '' or siret ~ '^[0-9]{14}$'),
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  manager_name text not null check (char_length(manager_name) between 2 and 120),
  contact_email text not null,
  contact_phone text not null default '',
  activity text not null check (activity in ('reparation', 'reconditionnement', 'diagnostic')),
  proof_document_path text,
  rules_accepted_at timestamptz,
  status text not null default 'brouillon'
    check (status in ('brouillon', 'en_attente', 'approuve', 'refuse', 'suspendu')),
  decision_reason text not null default '',
  decided_by uuid references public.nid_admins (id) on delete set null,
  decided_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_pro_status_idx
  on public.nid_professional_profiles (status, created_at desc);

drop trigger if exists nid_pro_updated_at on public.nid_professional_profiles;
create trigger nid_pro_updated_at
  before update on public.nid_professional_profiles
  for each row execute function public.set_updated_at();

-- Colonnes décidées par l'administration : un utilisateur ne peut jamais
-- s'auto-approuver, même en falsifiant sa requête PostgREST.
-- `auth.uid()` est NULL côté serveur (clé secrète) : l'admin garde la main.
create or replace function public.nid_protect_professional_decision()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.status          := case
                             when old.status = 'brouillon' and new.status in ('brouillon', 'en_attente')
                               then new.status
                             when old.status = 'refuse' and new.status = 'en_attente'
                               then 'en_attente'
                             else old.status
                           end;
    new.decision_reason := old.decision_reason;
    new.decided_by      := old.decided_by;
    new.decided_at      := old.decided_at;
    new.suspended_at    := old.suspended_at;
    new.user_id         := old.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.nid_protect_professional_decision() from public, anon, authenticated;

drop trigger if exists nid_pro_protect_decision on public.nid_professional_profiles;
create trigger nid_pro_protect_decision
  before update on public.nid_professional_profiles
  for each row execute function public.nid_protect_professional_decision();

alter table public.nid_professional_profiles enable row level security;

drop policy if exists "nid_pro_select_own" on public.nid_professional_profiles;
create policy "nid_pro_select_own" on public.nid_professional_profiles
  for select using ((select auth.uid()) = user_id);

drop policy if exists "nid_pro_insert_own" on public.nid_professional_profiles;
create policy "nid_pro_insert_own" on public.nid_professional_profiles
  for insert with check (
    (select auth.uid()) = user_id and status in ('brouillon', 'en_attente')
  );

drop policy if exists "nid_pro_update_own" on public.nid_professional_profiles;
create policy "nid_pro_update_own" on public.nid_professional_profiles
  for update using (
    (select auth.uid()) = user_id and status in ('brouillon', 'en_attente', 'refuse')
  )
  with check ((select auth.uid()) = user_id);

-- =============================================================
-- 3. Passeports (assets)
-- =============================================================

create table if not exists public.nid_assets (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant public NON séquentiel, lisible : NIR-PH-7K4M-92QF
  public_id text not null unique,
  category text not null default 'smartphone' check (category in ('smartphone')),
  brand text not null check (char_length(brand) between 1 and 60),
  model text not null check (char_length(model) between 1 and 80),
  color text not null default '',
  storage_capacity text not null default '',

  -- Identifiants privés : protégés par la RLS, jamais renvoyés par une
  -- lecture publique. Le projet ne dispose pas de chiffrement applicatif
  -- vérifié : on ne prétend donc PAS que ces colonnes sont chiffrées.
  serial_number_private text,
  serial_fingerprint text,
  serial_last4 text not null default '',
  imei_private text,
  imei_fingerprint text,
  imei_last4 text not null default '',

  purchase_date date,
  purchase_source text not null default '',
  purchase_condition text not null default 'inconnu'
    check (purchase_condition in ('neuf', 'reconditionne', 'occasion', 'inconnu')),
  declared_condition jsonb not null default '{}'::jsonb,

  primary_image_path text,
  status text not null default 'active'
    check (status in ('active', 'transfer_pending', 'archived', 'disputed')),

  -- Ce que le propriétaire accepte de montrer sur l'aperçu public.
  public_show_photo boolean not null default false,
  public_show_purchase_year boolean not null default false,
  public_show_serial_last4 boolean not null default false,

  -- Dénormalisation du propriétaire actif (source : nid_ownerships, tenue
  -- à jour par trigger) : la RLS reste simple, rapide et non récursive.
  current_owner_id uuid references auth.users (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_assets_owner_idx
  on public.nid_assets (current_owner_id, created_at desc);
create index if not exists nid_assets_status_idx on public.nid_assets (status);

-- Doublon suspect : un même appareil ne peut pas avoir deux passeports
-- actifs. Le message d'erreur ne révèle jamais à qui appartient l'autre.
create unique index if not exists nid_assets_serial_unique
  on public.nid_assets (serial_fingerprint)
  where serial_fingerprint is not null and status <> 'archived';
create unique index if not exists nid_assets_imei_unique
  on public.nid_assets (imei_fingerprint)
  where imei_fingerprint is not null and status <> 'archived';

drop trigger if exists nid_assets_updated_at on public.nid_assets;
create trigger nid_assets_updated_at
  before update on public.nid_assets
  for each row execute function public.set_updated_at();

alter table public.nid_assets enable row level security;

drop policy if exists "nid_assets_select_owner" on public.nid_assets;
create policy "nid_assets_select_owner" on public.nid_assets
  for select using ((select auth.uid()) = current_owner_id);

drop policy if exists "nid_assets_update_owner" on public.nid_assets;
create policy "nid_assets_update_owner" on public.nid_assets
  for update using ((select auth.uid()) = current_owner_id)
  with check ((select auth.uid()) = current_owner_id);

-- Pas de policy INSERT/DELETE : la création passe par nid_create_asset()
-- (atomique) et la suppression par nid_delete_asset() (nettoyage contrôlé).

-- =============================================================
-- 4. Propriétés successives
-- =============================================================

create table if not exists public.nid_ownerships (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  acquisition_mode text not null default 'creation'
    check (acquisition_mode in ('creation', 'transfert')),
  transfer_id uuid,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

create index if not exists nid_ownerships_asset_idx
  on public.nid_ownerships (asset_id, started_at desc);
create index if not exists nid_ownerships_owner_idx
  on public.nid_ownerships (owner_id);

-- Garantie structurelle : UNE SEULE propriété active par objet.
create unique index if not exists nid_ownerships_one_active
  on public.nid_ownerships (asset_id)
  where ended_at is null;

alter table public.nid_ownerships enable row level security;

drop policy if exists "nid_ownerships_select_own" on public.nid_ownerships;
create policy "nid_ownerships_select_own" on public.nid_ownerships
  for select using ((select auth.uid()) = owner_id);

-- Synchronise nid_assets.current_owner_id à partir de la propriété active.
create or replace function public.nid_sync_current_owner()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_asset uuid := coalesce(new.asset_id, old.asset_id);
begin
  update public.nid_assets a
     set current_owner_id = (
           select o.owner_id
             from public.nid_ownerships o
            where o.asset_id = v_asset and o.ended_at is null
            order by o.started_at desc
            limit 1
         )
   where a.id = v_asset;
  return null;
end;
$$;

revoke all on function public.nid_sync_current_owner() from public, anon, authenticated;

drop trigger if exists nid_ownerships_sync on public.nid_ownerships;
create trigger nid_ownerships_sync
  after insert or update or delete on public.nid_ownerships
  for each row execute function public.nid_sync_current_owner();

-- =============================================================
-- 5. Événements de l'historique
-- =============================================================

create table if not exists public.nid_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  type text not null check (type in (
    'achat', 'controle_etat', 'reparation', 'remplacement_piece',
    'incident', 'garantie', 'transfert', 'autre'
  )),
  effective_date date not null,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  author_user_id uuid references auth.users (id) on delete set null,
  author_role text not null default 'proprietaire'
    check (author_role in ('proprietaire', 'professionnel', 'systeme')),
  author_label text not null default '',
  professional_id uuid references public.nid_professional_profiles (id) on delete set null,
  -- 0 déclaré · 1 document fourni · 2 validé par un professionnel
  -- 3 contesté · 4 révoqué  (cf. src/features/nireo-id/constants.ts)
  trust_level smallint not null default 0 check (trust_level between 0 and 4),
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  currency text not null default 'EUR',
  metadata jsonb not null default '{}'::jsonb,
  replaced_event_id uuid references public.nid_events (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revocation_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_events_asset_idx
  on public.nid_events (asset_id, effective_date desc, created_at desc);
create index if not exists nid_events_pro_idx on public.nid_events (professional_id);

drop trigger if exists nid_events_updated_at on public.nid_events;
create trigger nid_events_updated_at
  before update on public.nid_events
  for each row execute function public.set_updated_at();

-- « Suis-je le propriétaire actif de cet objet ? » — helper SECURITY
-- DEFINER qui évite une évaluation RLS récursive dans les policies des
-- tables filles. Il ne prend PAS d'identité en paramètre : un client ne
-- peut donc pas sonder la propriété d'un autre utilisateur.
create or replace function public.nid_owns(p_asset_id uuid)
returns boolean
language sql
stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.nid_assets a
     where a.id = p_asset_id and a.current_owner_id = (select auth.uid())
  );
$$;

revoke all on function public.nid_owns(uuid) from public, anon;
-- Les policies ci-dessous sont évaluées avec les droits de l'appelant :
-- le rôle `authenticated` doit pouvoir exécuter ce helper.
grant execute on function public.nid_owns(uuid) to authenticated;

alter table public.nid_events enable row level security;

drop policy if exists "nid_events_select_owner" on public.nid_events;
create policy "nid_events_select_owner" on public.nid_events
  for select using (public.nid_owns(asset_id));

drop policy if exists "nid_events_insert_owner" on public.nid_events;
create policy "nid_events_insert_owner" on public.nid_events
  for insert with check (
    public.nid_owns(asset_id)
    and (select auth.uid()) = author_user_id
    -- Un particulier ne déclare JAMAIS un événement « validé par un
    -- professionnel » : ce niveau est réservé au serveur.
    and author_role = 'proprietaire'
    and trust_level = 0
    and professional_id is null
    and revoked_at is null
  );

-- Pas d'UPDATE/DELETE direct : une correction passe par une révocation
-- motivée (fonction serveur), jamais par un effacement silencieux.

-- =============================================================
-- 6. Documents privés
-- =============================================================

create table if not exists public.nid_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  event_id uuid references public.nid_events (id) on delete set null,
  -- Détenteur du document (l'auteur de l'envoi, ou l'acheteur après un
  -- transfert explicitement autorisé).
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('facture', 'garantie', 'rapport', 'autre')),
  storage_path text not null unique,
  original_name text not null default '',
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  transfer_policy text not null default 'prive'
    check (transfer_policy in ('prive', 'transferable', 'partage_temporaire')),
  -- Visible par le propriétaire courant du passeport (faux = document
  -- personnel conservé par un ancien propriétaire).
  visible_to_owner boolean not null default true,
  shared_until timestamptz,
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_documents_asset_idx
  on public.nid_documents (asset_id, created_at desc);
create index if not exists nid_documents_owner_idx
  on public.nid_documents (owner_user_id);

drop trigger if exists nid_documents_updated_at on public.nid_documents;
create trigger nid_documents_updated_at
  before update on public.nid_documents
  for each row execute function public.set_updated_at();

alter table public.nid_documents enable row level security;

drop policy if exists "nid_documents_select" on public.nid_documents;
create policy "nid_documents_select" on public.nid_documents
  for select using (
    (select auth.uid()) = owner_user_id
    or (
      visible_to_owner
      and (shared_until is null or shared_until > now())
      and public.nid_owns(asset_id)
    )
  );

drop policy if exists "nid_documents_insert_owner" on public.nid_documents;
create policy "nid_documents_insert_owner" on public.nid_documents
  for insert with check (
    (select auth.uid()) = owner_user_id
    and public.nid_owns(asset_id)
  );

-- Le détenteur ajuste la politique de transfert de SES documents
-- (les colonnes modifiables sont limitées plus bas, section 14).
drop policy if exists "nid_documents_update_own" on public.nid_documents;
create policy "nid_documents_update_own" on public.nid_documents
  for update using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "nid_documents_delete_own" on public.nid_documents;
create policy "nid_documents_delete_own" on public.nid_documents
  for delete using ((select auth.uid()) = owner_user_id);

-- Un document rattaché à un événement fait passer celui-ci au niveau
-- « Document fourni » — jamais au-dessus d'un niveau déjà plus élevé.
create or replace function public.nid_refresh_event_trust()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.event_id is not null then
    update public.nid_events e
       set trust_level = 1
     where e.id = new.event_id and e.trust_level = 0;
  end if;
  return null;
end;
$$;

revoke all on function public.nid_refresh_event_trust() from public, anon, authenticated;

drop trigger if exists nid_documents_trust on public.nid_documents;
create trigger nid_documents_trust
  after insert on public.nid_documents
  for each row execute function public.nid_refresh_event_trust();

-- =============================================================
-- 7. Photos
-- =============================================================

create table if not exists public.nid_media (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  event_id uuid references public.nid_events (id) on delete cascade,
  uploader_user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('principale', 'etat', 'evenement')),
  storage_path text not null unique,
  caption text not null default '',
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists nid_media_asset_idx
  on public.nid_media (asset_id, kind, position);

alter table public.nid_media enable row level security;

drop policy if exists "nid_media_select_owner" on public.nid_media;
create policy "nid_media_select_owner" on public.nid_media
  for select using (public.nid_owns(asset_id));

drop policy if exists "nid_media_insert_owner" on public.nid_media;
create policy "nid_media_insert_owner" on public.nid_media
  for insert with check (
    public.nid_owns(asset_id)
    and (select auth.uid()) = uploader_user_id
  );

drop policy if exists "nid_media_delete_owner" on public.nid_media;
create policy "nid_media_delete_owner" on public.nid_media
  for delete using (public.nid_owns(asset_id));

-- =============================================================
-- 8. Liens de partage privés
-- =============================================================

create table if not exists public.nid_share_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 du jeton : le jeton brut n'existe QUE dans le lien remis au
  -- propriétaire, jamais en base.
  token_hash text not null unique,
  label text not null default '',
  sections text[] not null default '{}',
  document_ids uuid[] not null default '{}',
  allow_download boolean not null default false,
  show_serial_last4 boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nid_share_asset_idx
  on public.nid_share_links (asset_id, created_at desc);
create index if not exists nid_share_expiry_idx
  on public.nid_share_links (expires_at) where revoked_at is null;

alter table public.nid_share_links enable row level security;

drop policy if exists "nid_share_select_owner" on public.nid_share_links;
create policy "nid_share_select_owner" on public.nid_share_links
  for select using (
    (select auth.uid()) = created_by
    or public.nid_owns(asset_id)
  );

drop policy if exists "nid_share_insert_owner" on public.nid_share_links;
create policy "nid_share_insert_owner" on public.nid_share_links
  for insert with check (
    (select auth.uid()) = created_by
    and public.nid_owns(asset_id)
  );

drop policy if exists "nid_share_update_owner" on public.nid_share_links;
create policy "nid_share_update_owner" on public.nid_share_links
  for update using (public.nid_owns(asset_id))
  with check (public.nid_owns(asset_id));

-- =============================================================
-- 9. Transferts de propriété
-- =============================================================

create table if not exists public.nid_transfers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  recipient_email text not null,
  buyer_id uuid references auth.users (id) on delete set null,
  token_hash text not null unique,
  status text not null default 'en_attente'
    check (status in ('en_attente', 'accepte', 'refuse', 'annule', 'expire')),
  expires_at timestamptz not null,
  options jsonb not null default '{}'::jsonb,
  -- Reçu conservé par le vendeur : ne contient JAMAIS les données privées
  -- futures du nouveau propriétaire.
  asset_summary jsonb not null default '{}'::jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_transfers_seller_idx
  on public.nid_transfers (seller_id, created_at desc);
create index if not exists nid_transfers_recipient_idx
  on public.nid_transfers (recipient_email, status);

-- Un seul transfert actif par objet.
create unique index if not exists nid_transfers_one_active
  on public.nid_transfers (asset_id)
  where status = 'en_attente';

drop trigger if exists nid_transfers_updated_at on public.nid_transfers;
create trigger nid_transfers_updated_at
  before update on public.nid_transfers
  for each row execute function public.set_updated_at();

alter table public.nid_transfers enable row level security;

drop policy if exists "nid_transfers_select_parties" on public.nid_transfers;
create policy "nid_transfers_select_parties" on public.nid_transfers
  for select using (
    (select auth.uid()) = seller_id
    or (select auth.uid()) = buyer_id
    or lower(recipient_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

-- Écriture : uniquement par les fonctions serveur (création, acceptation,
-- refus, annulation) — jamais par une requête directe du navigateur.

-- Le lien de propriété peut désormais référencer le transfert d'origine.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nid_ownerships_transfer_fkey'
  ) then
    alter table public.nid_ownerships
      add constraint nid_ownerships_transfer_fkey
      foreign key (transfer_id) references public.nid_transfers (id) on delete set null;
  end if;
end
$$;

-- =============================================================
-- 10. Accès professionnel à un passeport
-- =============================================================

create table if not exists public.nid_professional_access (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  professional_id uuid not null references public.nid_professional_profiles (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  granted_by uuid references auth.users (id) on delete set null,
  source text not null check (source in ('lien_partage', 'invitation', 'demande_identifiant')),
  scope text not null default 'intervention' check (scope in ('lecture', 'intervention')),
  status text not null default 'en_attente'
    check (status in ('en_attente', 'accorde', 'refuse', 'revoque', 'expire')),
  message text not null default '',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_pro_access_asset_idx
  on public.nid_professional_access (asset_id, status);
create index if not exists nid_pro_access_pro_idx
  on public.nid_professional_access (professional_id, status, created_at desc);

-- Une seule demande/autorisation vivante par couple (objet, professionnel).
create unique index if not exists nid_pro_access_one_live
  on public.nid_professional_access (asset_id, professional_id)
  where status in ('en_attente', 'accorde');

drop trigger if exists nid_pro_access_updated_at on public.nid_professional_access;
create trigger nid_pro_access_updated_at
  before update on public.nid_professional_access
  for each row execute function public.set_updated_at();

alter table public.nid_professional_access enable row level security;

drop policy if exists "nid_pro_access_select" on public.nid_professional_access;
create policy "nid_pro_access_select" on public.nid_professional_access
  for select using (
    public.nid_owns(asset_id)
    or professional_id in (
      select p.id from public.nid_professional_profiles p
       where p.user_id = (select auth.uid())
    )
  );

-- Écriture par le serveur uniquement (vérification du statut professionnel).

-- =============================================================
-- 11. Signalements
-- =============================================================

create table if not exists public.nid_disputes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  event_id uuid references public.nid_events (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in (
    'information_inexacte', 'document_suspect', 'usurpation', 'autre'
  )),
  description text not null default '',
  status text not null default 'ouvert'
    check (status in ('ouvert', 'en_examen', 'resolu', 'rejete')),
  resolution text not null default '',
  handled_by uuid references public.nid_admins (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_disputes_status_idx
  on public.nid_disputes (status, created_at desc);
create index if not exists nid_disputes_asset_idx on public.nid_disputes (asset_id);

drop trigger if exists nid_disputes_updated_at on public.nid_disputes;
create trigger nid_disputes_updated_at
  before update on public.nid_disputes
  for each row execute function public.set_updated_at();

alter table public.nid_disputes enable row level security;

drop policy if exists "nid_disputes_select_own" on public.nid_disputes;
create policy "nid_disputes_select_own" on public.nid_disputes
  for select using ((select auth.uid()) = reporter_id);

-- =============================================================
-- 12. Journal d'audit — APPEND ONLY
-- =============================================================

create table if not exists public.nid_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text not null default 'utilisateur'
    check (actor_role in ('utilisateur', 'professionnel', 'administrateur', 'systeme')),
  action text not null,
  target_type text not null default '',
  target_id uuid,
  asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nid_audit_created_idx on public.nid_audit_logs (created_at desc);
create index if not exists nid_audit_asset_idx on public.nid_audit_logs (asset_id, created_at desc);
create index if not exists nid_audit_action_idx on public.nid_audit_logs (action);

alter table public.nid_audit_logs enable row level security;
revoke all on table public.nid_audit_logs from anon, authenticated;

-- Immuable : même la clé secrète ne peut ni modifier ni supprimer une ligne.
create or replace function public.nid_audit_append_only()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  raise exception 'nid_audit_logs est un journal append-only.';
end;
$$;

revoke all on function public.nid_audit_append_only() from public, anon, authenticated;

drop trigger if exists nid_audit_immutable on public.nid_audit_logs;
create trigger nid_audit_immutable
  before update or delete on public.nid_audit_logs
  for each row execute function public.nid_audit_append_only();

-- =============================================================
-- 13. Fonctions serveur
-- =============================================================

-- ---------- Identifiant public non séquentiel ----------
-- Alphabet sans caractères ambigus (ni 0/O, ni 1/I/L) : lisible à voix
-- haute et re-saisissable sans erreur.
create or replace function public.nid_generate_public_id()
returns text
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_candidate text;
  v_block text;
  i integer;
  j integer;
begin
  for i in 1..40 loop
    v_candidate := 'NIR-PH';
    for j in 1..2 loop
      v_block := '';
      while char_length(v_block) < 4 loop
        v_block := v_block || substr(v_alphabet, 1 + floor(random() * char_length(v_alphabet))::int, 1);
      end loop;
      v_candidate := v_candidate || '-' || v_block;
    end loop;
    if not exists (select 1 from public.nid_assets a where a.public_id = v_candidate) then
      return v_candidate;
    end if;
  end loop;
  raise exception 'Génération de l''identifiant Nireo impossible.';
end;
$$;

revoke all on function public.nid_generate_public_id() from public, anon, authenticated;

-- ---------- Création atomique d'un passeport ----------
-- Tout réussit (passeport + propriété + événements + photos + documents
-- + audit) ou rien n'est créé : aucune ligne orpheline possible.
create or replace function public.nid_create_asset(
  p_owner_id uuid,
  p_asset_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_public_id text;
  v_serial_fp text := nullif(p_payload ->> 'serial_fingerprint', '');
  v_imei_fp text := nullif(p_payload ->> 'imei_fingerprint', '');
  v_purchase_date date := nullif(p_payload ->> 'purchase_date', '')::date;
  v_event_id uuid;
  v_item jsonb;
begin
  if p_owner_id is null or p_asset_id is null then
    raise exception 'Paramètres manquants pour la création du passeport.';
  end if;

  -- Doublon : message volontairement neutre (on ne révèle jamais l'identité
  -- du détenteur d'un appareil déjà enregistré).
  if v_serial_fp is not null and exists (
    select 1 from public.nid_assets a
     where a.serial_fingerprint = v_serial_fp and a.status <> 'archived'
  ) then
    raise exception 'SERIAL_ALREADY_REGISTERED';
  end if;
  if v_imei_fp is not null and exists (
    select 1 from public.nid_assets a
     where a.imei_fingerprint = v_imei_fp and a.status <> 'archived'
  ) then
    raise exception 'IMEI_ALREADY_REGISTERED';
  end if;

  v_public_id := public.nid_generate_public_id();

  insert into public.nid_assets (
    id, public_id, category, brand, model, color, storage_capacity,
    serial_number_private, serial_fingerprint, serial_last4,
    imei_private, imei_fingerprint, imei_last4,
    purchase_date, purchase_source, purchase_condition, declared_condition,
    primary_image_path, status, current_owner_id, created_by
  ) values (
    p_asset_id, v_public_id, 'smartphone',
    p_payload ->> 'brand',
    p_payload ->> 'model',
    coalesce(p_payload ->> 'color', ''),
    coalesce(p_payload ->> 'storage_capacity', ''),
    nullif(p_payload ->> 'serial_number', ''), v_serial_fp,
    coalesce(p_payload ->> 'serial_last4', ''),
    nullif(p_payload ->> 'imei', ''), v_imei_fp,
    coalesce(p_payload ->> 'imei_last4', ''),
    v_purchase_date,
    coalesce(p_payload ->> 'purchase_source', ''),
    coalesce(p_payload ->> 'purchase_condition', 'inconnu'),
    coalesce(p_payload -> 'declared_condition', '{}'::jsonb),
    nullif(p_payload ->> 'primary_image_path', ''),
    'active', p_owner_id, p_owner_id
  );

  insert into public.nid_ownerships (asset_id, owner_id, acquisition_mode)
  values (p_asset_id, p_owner_id, 'creation');

  -- Événement « achat » si une date d'achat a été renseignée.
  if v_purchase_date is not null then
    insert into public.nid_events (
      asset_id, type, effective_date, title, description,
      author_user_id, author_role, trust_level
    ) values (
      p_asset_id, 'achat', v_purchase_date,
      'Achat déclaré',
      trim(coalesce(p_payload ->> 'purchase_source', '')),
      p_owner_id, 'proprietaire', 0
    );
  end if;

  -- Constat d'état initial déclaré par le propriétaire.
  if coalesce(p_payload -> 'declared_condition', '{}'::jsonb) <> '{}'::jsonb then
    insert into public.nid_events (
      asset_id, type, effective_date, title, description,
      author_user_id, author_role, trust_level, metadata
    ) values (
      p_asset_id, 'controle_etat', current_date,
      'État déclaré à la création',
      coalesce(p_payload -> 'declared_condition' ->> 'comment', ''),
      p_owner_id, 'proprietaire', 0,
      coalesce(p_payload -> 'declared_condition', '{}'::jsonb)
    )
    returning id into v_event_id;
  end if;

  -- Photos.
  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'media', '[]'::jsonb))
  loop
    insert into public.nid_media (
      asset_id, event_id, uploader_user_id, kind, storage_path, caption, position
    ) values (
      p_asset_id,
      case when v_item ->> 'kind' = 'etat' then v_event_id else null end,
      p_owner_id,
      v_item ->> 'kind',
      v_item ->> 'storage_path',
      coalesce(v_item ->> 'caption', ''),
      coalesce((v_item ->> 'position')::smallint, 0)
    );
  end loop;

  -- Documents (preuve d'achat…).
  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'documents', '[]'::jsonb))
  loop
    insert into public.nid_documents (
      asset_id, event_id, owner_user_id, kind, storage_path,
      original_name, mime_type, size_bytes, transfer_policy
    ) values (
      p_asset_id, null, p_owner_id,
      v_item ->> 'kind',
      v_item ->> 'storage_path',
      coalesce(v_item ->> 'original_name', ''),
      v_item ->> 'mime_type',
      (v_item ->> 'size_bytes')::bigint,
      coalesce(v_item ->> 'transfer_policy', 'prive')
    );
  end loop;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_owner_id, 'utilisateur', 'asset.created', 'asset', p_asset_id, p_asset_id,
          jsonb_build_object('public_id', v_public_id));

  return jsonb_build_object('id', p_asset_id, 'public_id', v_public_id);
end;
$$;

revoke all on function public.nid_create_asset(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- Aperçu public minimal ----------
-- Ne renvoie QUE les champs autorisés : jamais de nom, d'adresse, d'IMEI
-- complet, de document ni d'historique d'accès.
create or replace function public.nid_public_preview(p_public_id text)
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'public_id', a.public_id,
    'brand', a.brand,
    'model', a.model,
    'color', a.color,
    'status', a.status,
    'photo_path', case when a.public_show_photo then a.primary_image_path else null end,
    'purchase_year', case
      when a.public_show_purchase_year and a.purchase_date is not null
        then extract(year from a.purchase_date)::int
      else null end,
    'serial_last4', case when a.public_show_serial_last4 then nullif(a.serial_last4, '') else null end,
    'events_total', (
      select count(*) from public.nid_events e
       where e.asset_id = a.id and e.revoked_at is null
    ),
    'events_professional', (
      select count(*) from public.nid_events e
       where e.asset_id = a.id and e.revoked_at is null and e.trust_level = 2
    ),
    'events_disputed', (
      select count(*) from public.nid_events e
       where e.asset_id = a.id and e.trust_level = 3
    ),
    'created_at', a.created_at,
    'transfers_count', (
      select count(*) from public.nid_ownerships o where o.asset_id = a.id
    )
  )
  from public.nid_assets a
  where a.public_id = upper(trim(p_public_id))
    and a.status <> 'archived';
$$;

revoke all on function public.nid_public_preview(text) from public, anon, authenticated;

-- ---------- Résolution d'un lien de partage privé ----------
create or replace function public.nid_resolve_share(p_token_hash text)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_share public.nid_share_links;
  v_asset public.nid_assets;
begin
  select * into v_share from public.nid_share_links s where s.token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_share.revoked_at is not null then
    return jsonb_build_object('state', 'revoque');
  end if;
  if v_share.expires_at <= now() then
    return jsonb_build_object('state', 'expire');
  end if;

  select * into v_asset from public.nid_assets a where a.id = v_share.asset_id;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;

  update public.nid_share_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_share.id;

  insert into public.nid_audit_logs (actor_role, action, target_type, target_id, asset_id)
  values ('systeme', 'share.viewed', 'share_link', v_share.id, v_asset.id);

  return jsonb_build_object(
    'state', 'valide',
    'share', jsonb_build_object(
      'id', v_share.id,
      'label', v_share.label,
      'sections', to_jsonb(v_share.sections),
      'allow_download', v_share.allow_download,
      'show_serial_last4', v_share.show_serial_last4,
      'expires_at', v_share.expires_at
    ),
    'asset', jsonb_build_object(
      'id', v_asset.id,
      'public_id', v_asset.public_id,
      'brand', v_asset.brand,
      'model', v_asset.model,
      'color', v_asset.color,
      'storage_capacity', v_asset.storage_capacity,
      'purchase_date', v_asset.purchase_date,
      'purchase_source', v_asset.purchase_source,
      'purchase_condition', v_asset.purchase_condition,
      'declared_condition', v_asset.declared_condition,
      'status', v_asset.status,
      'primary_image_path', v_asset.primary_image_path,
      'serial_last4', case when v_share.show_serial_last4 then nullif(v_asset.serial_last4, '') else null end
    ),
    'events', case when 'historique' = any (v_share.sections) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'type', e.type, 'effective_date', e.effective_date,
        'title', e.title, 'description', e.description,
        'author_role', e.author_role, 'author_label', e.author_label,
        'trust_level', e.trust_level, 'cost_cents', e.cost_cents,
        'metadata', e.metadata, 'revoked_at', e.revoked_at
      ) order by e.effective_date desc, e.created_at desc), '[]'::jsonb)
      from public.nid_events e where e.asset_id = v_asset.id
    ) else '[]'::jsonb end,
    'media', case when 'photos' = any (v_share.sections) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'storage_path', m.storage_path, 'caption', m.caption, 'kind', m.kind
      ) order by m.position, m.created_at), '[]'::jsonb)
      from public.nid_media m where m.asset_id = v_asset.id
    ) else '[]'::jsonb end,
    'documents', case when 'documents' = any (v_share.sections) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'original_name', d.original_name,
        'mime_type', d.mime_type, 'size_bytes', d.size_bytes, 'storage_path', d.storage_path
      ) order by d.created_at), '[]'::jsonb)
      from public.nid_documents d
      where d.asset_id = v_asset.id
        and d.status = 'actif'
        and d.id = any (v_share.document_ids)
    ) else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.nid_resolve_share(text) from public, anon, authenticated;

-- ---------- Acceptation atomique d'un transfert ----------
-- Verrouille la demande, vérifie le propriétaire, clôture l'ancienne
-- propriété, crée la nouvelle, journalise l'événement, applique la
-- politique des documents, révoque les partages du vendeur, écrit l'audit.
-- Une double acceptation (double clic, double onglet) n'aboutit qu'une fois.
create or replace function public.nid_accept_transfer(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_transfer public.nid_transfers;
  v_asset public.nid_assets;
begin
  select * into v_transfer
    from public.nid_transfers t
   where t.token_hash = p_token_hash
   for update;

  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_transfer.status <> 'en_attente' then
    return jsonb_build_object('state', 'deja_traite', 'status', v_transfer.status);
  end if;
  if v_transfer.expires_at <= now() then
    update public.nid_transfers set status = 'expire', responded_at = now()
     where id = v_transfer.id;
    return jsonb_build_object('state', 'expire');
  end if;
  if lower(coalesce(p_user_email, '')) <> lower(v_transfer.recipient_email) then
    return jsonb_build_object('state', 'destinataire_different');
  end if;
  if v_transfer.seller_id = p_user_id then
    return jsonb_build_object('state', 'auto_transfert');
  end if;

  select * into v_asset from public.nid_assets a where a.id = v_transfer.asset_id for update;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  -- Le vendeur doit toujours être le propriétaire actif au moment de l'acceptation.
  if v_asset.current_owner_id is distinct from v_transfer.seller_id then
    update public.nid_transfers set status = 'annule', responded_at = now()
     where id = v_transfer.id;
    return jsonb_build_object('state', 'vendeur_plus_proprietaire');
  end if;

  -- 1. Clôture de la propriété précédente.
  update public.nid_ownerships
     set ended_at = now(), status = 'ended'
   where asset_id = v_asset.id and ended_at is null;

  -- 2. Nouvelle propriété (le trigger met à jour nid_assets.current_owner_id).
  insert into public.nid_ownerships (asset_id, owner_id, acquisition_mode, transfer_id)
  values (v_asset.id, p_user_id, 'transfert', v_transfer.id);

  -- 3. Événement de transfert dans l'historique (jamais d'identité nominative).
  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, author_label, trust_level
  ) values (
    v_asset.id, 'transfert', current_date,
    'Changement de propriétaire',
    'Le passeport a été transmis à un nouveau propriétaire via Nireo ID.',
    p_user_id, 'systeme', 'Nireo ID', 0
  );

  -- 4. Politique des documents.
  --    · transferable        → le document suit l'objet ;
  --    · partage_temporaire  → visible 30 jours par le nouveau propriétaire ;
  --    · prive (défaut)      → reste strictement au vendeur.
  update public.nid_documents
     set owner_user_id = p_user_id, visible_to_owner = true, shared_until = null
   where asset_id = v_asset.id
     and owner_user_id = v_transfer.seller_id
     and transfer_policy = 'transferable';

  update public.nid_documents
     set visible_to_owner = true, shared_until = now() + interval '30 days'
   where asset_id = v_asset.id
     and owner_user_id = v_transfer.seller_id
     and transfer_policy = 'partage_temporaire';

  update public.nid_documents
     set visible_to_owner = false, shared_until = null
   where asset_id = v_asset.id
     and owner_user_id = v_transfer.seller_id
     and transfer_policy = 'prive';

  -- 5. Les partages créés par l'ancien propriétaire sont révoqués.
  update public.nid_share_links
     set revoked_at = now(), revoked_by = p_user_id
   where asset_id = v_asset.id and created_by = v_transfer.seller_id and revoked_at is null;

  -- 6. Les accès professionnels ouverts par l'ancien propriétaire tombent.
  update public.nid_professional_access
     set status = 'revoque', revoked_at = now()
   where asset_id = v_asset.id and status in ('en_attente', 'accorde');

  -- 7. L'objet redevient « actif ».
  update public.nid_assets set status = 'active' where id = v_asset.id;

  -- 8. Demande marquée acceptée (idempotence garantie par le FOR UPDATE).
  update public.nid_transfers
     set status = 'accepte', buyer_id = p_user_id, responded_at = now()
   where id = v_transfer.id;

  -- 9. Audit.
  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_user_id, 'utilisateur', 'transfer.accepted', 'transfer', v_transfer.id, v_asset.id,
          jsonb_build_object('public_id', v_asset.public_id));

  return jsonb_build_object(
    'state', 'accepte',
    'asset_id', v_asset.id,
    'public_id', v_asset.public_id
  );
end;
$$;

revoke all on function public.nid_accept_transfer(text, uuid, text) from public, anon, authenticated;

-- ---------- Intervention professionnelle ----------
-- L'événement ne porte le niveau « Validé par un professionnel » que si
-- TOUTES les conditions serveur sont réunies : compte approuvé (non
-- suspendu) ET accès accordé, non expiré, non révoqué, sur CET objet.
create or replace function public.nid_pro_add_event(
  p_user_id uuid,
  p_asset_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_pro public.nid_professional_profiles;
  v_access public.nid_professional_access;
  v_event_id uuid;
  v_item jsonb;
begin
  select * into v_pro
    from public.nid_professional_profiles p
   where p.user_id = p_user_id;
  if not found or v_pro.status <> 'approuve' then
    return jsonb_build_object('state', 'pro_non_approuve');
  end if;

  select * into v_access
    from public.nid_professional_access acc
   where acc.asset_id = p_asset_id
     and acc.professional_id = v_pro.id
     and acc.status = 'accorde'
     and acc.scope = 'intervention'
     and acc.expires_at > now()
     and acc.revoked_at is null;
  if not found then
    return jsonb_build_object('state', 'acces_refuse');
  end if;

  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, author_label, professional_id,
    trust_level, cost_cents, metadata
  ) values (
    p_asset_id,
    p_payload ->> 'type',
    (p_payload ->> 'effective_date')::date,
    p_payload ->> 'title',
    coalesce(p_payload ->> 'description', ''),
    p_user_id, 'professionnel', v_pro.trade_name, v_pro.id,
    2,
    nullif(p_payload ->> 'cost_cents', '')::integer,
    coalesce(p_payload -> 'metadata', '{}'::jsonb)
  )
  returning id into v_event_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'media', '[]'::jsonb))
  loop
    insert into public.nid_media (asset_id, event_id, uploader_user_id, kind, storage_path, caption, position)
    values (
      p_asset_id, v_event_id, p_user_id, 'evenement',
      v_item ->> 'storage_path', coalesce(v_item ->> 'caption', ''),
      coalesce((v_item ->> 'position')::smallint, 0)
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'documents', '[]'::jsonb))
  loop
    insert into public.nid_documents (
      asset_id, event_id, owner_user_id, kind, storage_path,
      original_name, mime_type, size_bytes, transfer_policy, visible_to_owner
    ) values (
      p_asset_id, v_event_id, p_user_id,
      coalesce(v_item ->> 'kind', 'rapport'),
      v_item ->> 'storage_path',
      coalesce(v_item ->> 'original_name', ''),
      v_item ->> 'mime_type',
      (v_item ->> 'size_bytes')::bigint,
      'transferable', true
    );
  end loop;

  -- Un document ne doit jamais faire redescendre une validation professionnelle.
  update public.nid_events set trust_level = 2 where id = v_event_id;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_user_id, 'professionnel', 'event.professional_added', 'event', v_event_id, p_asset_id,
          jsonb_build_object('professional_id', v_pro.id));

  return jsonb_build_object('state', 'cree', 'event_id', v_event_id);
end;
$$;

revoke all on function public.nid_pro_add_event(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- Événement déclaré par le propriétaire (atomique) ----------
-- L'événement, ses photos et ses documents sont écrits ensemble : jamais
-- d'événement sans ses pièces jointes, jamais de pièce jointe orpheline.
-- Le niveau de confiance reste 0 (déclaré) ; le trigger des documents le
-- fait passer à 1 (« Document fourni ») si une pièce est jointe.
create or replace function public.nid_add_owner_event(
  p_owner_id uuid,
  p_asset_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_event_id uuid;
  v_item jsonb;
begin
  if not exists (
    select 1 from public.nid_assets a
     where a.id = p_asset_id and a.current_owner_id = p_owner_id
  ) then
    return jsonb_build_object('state', 'non_proprietaire');
  end if;

  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, trust_level, cost_cents, metadata
  ) values (
    p_asset_id,
    p_payload ->> 'type',
    (p_payload ->> 'effective_date')::date,
    p_payload ->> 'title',
    coalesce(p_payload ->> 'description', ''),
    p_owner_id, 'proprietaire', 0,
    nullif(p_payload ->> 'cost_cents', '')::integer,
    coalesce(p_payload -> 'metadata', '{}'::jsonb)
  )
  returning id into v_event_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'media', '[]'::jsonb))
  loop
    insert into public.nid_media (asset_id, event_id, uploader_user_id, kind, storage_path, caption, position)
    values (
      p_asset_id, v_event_id, p_owner_id, 'evenement',
      v_item ->> 'storage_path', coalesce(v_item ->> 'caption', ''),
      coalesce((v_item ->> 'position')::smallint, 0)
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'documents', '[]'::jsonb))
  loop
    insert into public.nid_documents (
      asset_id, event_id, owner_user_id, kind, storage_path,
      original_name, mime_type, size_bytes, transfer_policy
    ) values (
      p_asset_id, v_event_id, p_owner_id,
      coalesce(v_item ->> 'kind', 'autre'),
      v_item ->> 'storage_path',
      coalesce(v_item ->> 'original_name', ''),
      v_item ->> 'mime_type',
      (v_item ->> 'size_bytes')::bigint,
      coalesce(v_item ->> 'transfer_policy', 'prive')
    );
  end loop;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
  values (p_owner_id, 'utilisateur', 'event.declared', 'event', v_event_id, p_asset_id);

  return jsonb_build_object('state', 'cree', 'event_id', v_event_id);
end;
$$;

revoke all on function public.nid_add_owner_event(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- Révocation motivée d'un événement ----------
-- Jamais de suppression silencieuse : l'événement reste visible, marqué
-- « Révoqué », avec son motif et une trace d'audit.
create or replace function public.nid_revoke_event(
  p_event_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_event public.nid_events;
begin
  select * into v_event from public.nid_events e where e.id = p_event_id for update;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_event.revoked_at is not null then
    return jsonb_build_object('state', 'deja_revoque');
  end if;

  update public.nid_events
     set revoked_at = now(),
         revoked_by = p_actor_user_id,
         revocation_reason = left(coalesce(p_reason, ''), 500),
         trust_level = 4
   where id = p_event_id;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_actor_user_id, p_actor_role, 'event.revoked', 'event', p_event_id, v_event.asset_id,
          jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)));

  return jsonb_build_object('state', 'revoque');
end;
$$;

revoke all on function public.nid_revoke_event(uuid, uuid, text, text) from public, anon, authenticated;

-- =============================================================
-- 14. Privilèges colonne par colonne (défense en profondeur)
-- =============================================================
-- La RLS dit QUELLES LIGNES un utilisateur touche ; les privilèges
-- ci-dessous disent QUELLES COLONNES. Sans eux, un propriétaire pourrait
-- réécrire l'identifiant public de son passeport, ses empreintes
-- d'identifiants ou le libellé d'auteur d'un événement via un appel
-- PostgREST direct — sans jamais passer par l'interface.

-- Passeport : seules les caractéristiques et la visibilité publique sont
-- modifiables. `status`, `public_id`, les empreintes et le propriétaire
-- ne changent que par une fonction serveur.
revoke update, delete on table public.nid_assets from anon, authenticated;
grant update (
  brand, model, color, storage_capacity,
  purchase_date, purchase_source, purchase_condition, declared_condition,
  primary_image_path,
  public_show_photo, public_show_purchase_year, public_show_serial_last4
) on table public.nid_assets to authenticated;

-- Événements : jamais de libellé d'auteur ni de rattachement professionnel
-- posé par le navigateur (le niveau de confiance est déjà borné par la policy).
revoke insert, update, delete on table public.nid_events from anon, authenticated;
grant insert (
  asset_id, type, effective_date, title, description,
  author_user_id, author_role, trust_level, cost_cents, currency, metadata
) on table public.nid_events to authenticated;

-- Documents : le détenteur choisit sa politique de transfert, rien d'autre.
revoke update on table public.nid_documents from anon, authenticated;
grant update (kind, transfer_policy) on table public.nid_documents to authenticated;

-- Liens de partage : la seule modification possible est la révocation.
revoke update, delete on table public.nid_share_links from anon, authenticated;
grant update (revoked_at, revoked_by) on table public.nid_share_links to authenticated;

-- Transferts, accès professionnels, signalements et propriétés : écriture
-- exclusivement serveur (aucune policy d'écriture n'existe de toute façon).
revoke insert, update, delete on table public.nid_transfers from anon, authenticated;
revoke insert, update, delete on table public.nid_professional_access from anon, authenticated;
revoke insert, update, delete on table public.nid_disputes from anon, authenticated;
revoke insert, update, delete on table public.nid_ownerships from anon, authenticated;

-- =============================================================
-- 15. Stockage privé
-- =============================================================
-- Bucket PRIVÉ : aucune URL publique persistante. Les lectures passent
-- toujours par une URL signée de courte durée générée côté serveur.
-- Convention : {userId}/{assetId}/{documents|media}/{uuid}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nireo-id-private',
  'nireo-id-private',
  false,
  10485760, -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chacun n'écrit et ne lit que dans SON dossier racine. Les lectures
-- croisées légitimes (propriétaire ↔ professionnel) passent par des URL
-- signées générées côté serveur après vérification des droits.
drop policy if exists "nid_storage_select_own" on storage.objects;
create policy "nid_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'nireo-id-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "nid_storage_insert_own" on storage.objects;
create policy "nid_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'nireo-id-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "nid_storage_update_own" on storage.objects;
create policy "nid_storage_update_own" on storage.objects
  for update using (
    bucket_id = 'nireo-id-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'nireo-id-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "nid_storage_delete_own" on storage.objects;
create policy "nid_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'nireo-id-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
