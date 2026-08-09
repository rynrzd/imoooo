-- =============================================================
-- NIREO ID V2 — suivi simple et permanent d'un téléphone.
--
-- Cette migration COMPLÈTE 20260808090000_nireo_id.sql (jamais modifiée) :
--  • espaces (personnel, entreprise, atelier), membres, rôles, invitations ;
--  • affectations d'un téléphone à un détenteur (≠ propriété) ;
--  • bilans : planification, demandes à jeton haché, réponses, campagnes ;
--  • ordres de réparation et accès temporaire du réparateur ;
--  • provenance explicite de chaque événement ;
--  • plans et quotas Nireo ID, indépendants de Nireo Immo ;
--  • journal Stripe propre à Nireo ID (idempotence des webhooks).
--
-- Règles respectées :
--  • aucune table, policy, fonction ou route de Nireo Immo n'est touchée ;
--  • aucun objet existant n'est supprimé, aucune donnée n'est effacée ;
--  • 100 % idempotente (ré-exécutable sans effet de bord) ;
--  • RLS activée sur toutes les nouvelles tables ; écriture sensible
--    réservée à des fonctions SECURITY DEFINER à search_path fixé ;
--  • les jetons (bilan, réparation, invitation) ne sont stockés que hachés.
-- =============================================================

begin;

-- =============================================================
-- 1. Espaces (workspaces)
-- =============================================================
-- Vocabulaire interface : « espace personnel », « entreprise », « atelier ».
-- Un même compte Nireo peut appartenir à plusieurs espaces : il n'existe
-- AUCUN choix définitif « particulier ou professionnel ».

create table if not exists public.nid_workspaces (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('personnel', 'entreprise', 'atelier')),
  name text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  timezone text not null default 'Europe/Paris',

  -- Abonnement Nireo ID — STRICTEMENT indépendant de Nireo Immo.
  plan text not null default 'perso_gratuit',
  plan_status text not null default 'actif'
    check (plan_status in ('actif', 'impaye', 'annule')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un seul espace personnel par compte.
create unique index if not exists nid_workspaces_personal_unique
  on public.nid_workspaces (owner_user_id)
  where kind = 'personnel';

create index if not exists nid_workspaces_owner_idx
  on public.nid_workspaces (owner_user_id, kind);

drop trigger if exists nid_workspaces_updated_at on public.nid_workspaces;
create trigger nid_workspaces_updated_at
  before update on public.nid_workspaces
  for each row execute function public.set_updated_at();

create table if not exists public.nid_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.nid_workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  -- Un salarié peut être enregistré par nom et e-mail sans compte complet :
  -- il répond alors au bilan par jeton, sans jamais voir le parc.
  display_name text not null default '',
  email text not null default '',
  role text not null default 'member'
    check (role in ('owner', 'admin', 'manager', 'member', 'viewer')),
  status text not null default 'actif' check (status in ('actif', 'invite', 'retire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists nid_members_unique
  on public.nid_workspace_members (workspace_id, user_id)
  where user_id is not null;
create index if not exists nid_members_user_idx
  on public.nid_workspace_members (user_id, status);
create index if not exists nid_members_workspace_idx
  on public.nid_workspace_members (workspace_id, status);

drop trigger if exists nid_members_updated_at on public.nid_workspace_members;
create trigger nid_members_updated_at
  before update on public.nid_workspace_members
  for each row execute function public.set_updated_at();

create table if not exists public.nid_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.nid_workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('admin', 'manager', 'member', 'viewer')),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nid_invites_workspace_idx
  on public.nid_workspace_invites (workspace_id, created_at desc);
create index if not exists nid_invites_email_idx
  on public.nid_workspace_invites (lower(email));

-- ---------- Helpers de rôle (non récursifs) ----------
-- SECURITY DEFINER : la fonction appartient au propriétaire des tables,
-- l'évaluation ne repasse donc pas par les policies (aucune récursion).
-- Aucune identité en paramètre : impossible de sonder les droits d'autrui.

create or replace function public.nid_workspace_role(p_workspace uuid)
returns text
language sql
stable security definer set search_path = ''
as $$
  select m.role
    from public.nid_workspace_members m
   where m.workspace_id = p_workspace
     and m.user_id = (select auth.uid())
     and m.status = 'actif'
   limit 1;
$$;

revoke all on function public.nid_workspace_role(uuid) from public, anon;
grant execute on function public.nid_workspace_role(uuid) to authenticated;

create or replace function public.nid_is_member(p_workspace uuid)
returns boolean
language sql
stable security definer set search_path = ''
as $$
  select public.nid_workspace_role(p_workspace) is not null;
$$;

revoke all on function public.nid_is_member(uuid) from public, anon;
grant execute on function public.nid_is_member(uuid) to authenticated;

create or replace function public.nid_has_role(p_workspace uuid, p_roles text[])
returns boolean
language sql
stable security definer set search_path = ''
as $$
  select public.nid_workspace_role(p_workspace) = any (p_roles);
$$;

revoke all on function public.nid_has_role(uuid, text[]) from public, anon;
grant execute on function public.nid_has_role(uuid, text[]) to authenticated;

alter table public.nid_workspaces enable row level security;
alter table public.nid_workspace_members enable row level security;
alter table public.nid_workspace_invites enable row level security;

drop policy if exists "nid_workspaces_select_member" on public.nid_workspaces;
create policy "nid_workspaces_select_member" on public.nid_workspaces
  for select using (
    (select auth.uid()) = owner_user_id or public.nid_is_member(id)
  );

-- Seuls le nom et le fuseau sont modifiables par l'interface (cf. grants).
drop policy if exists "nid_workspaces_update_admin" on public.nid_workspaces;
create policy "nid_workspaces_update_admin" on public.nid_workspaces
  for update using (public.nid_has_role(id, array['owner', 'admin']))
  with check (public.nid_has_role(id, array['owner', 'admin']));

drop policy if exists "nid_members_select" on public.nid_workspace_members;
create policy "nid_members_select" on public.nid_workspace_members
  for select using (
    (select auth.uid()) = user_id or public.nid_is_member(workspace_id)
  );

drop policy if exists "nid_invites_select_admin" on public.nid_workspace_invites;
create policy "nid_invites_select_admin" on public.nid_workspace_invites
  for select using (public.nid_has_role(workspace_id, array['owner', 'admin']));

revoke insert, update, delete on table public.nid_workspaces from anon, authenticated;
grant update (name, timezone) on table public.nid_workspaces to authenticated;
revoke insert, update, delete on table public.nid_workspace_members from anon, authenticated;
revoke insert, update, delete on table public.nid_workspace_invites from anon, authenticated;

-- =============================================================
-- 2. Plans et quotas Nireo ID
-- =============================================================
-- Table de référence : la vitrine et l'application lisent la même source
-- (src/features/nireo-id/plans.ts) ; le quota est REVÉRIFIÉ ici, en base.

create table if not exists public.nid_plan_limits (
  plan text primary key,
  kind text not null check (kind in ('personnel', 'entreprise', 'atelier')),
  label text not null,
  max_assets integer,          -- null = pas de plafond
  max_members integer,         -- null = pas de plafond
  price_cents integer not null default 0,
  period text not null default 'mois' check (period in ('mois', 'an', 'gratuit')),
  updated_at timestamptz not null default now()
);

insert into public.nid_plan_limits (plan, kind, label, max_assets, max_members, price_cents, period)
values
  ('perso_gratuit',        'personnel',  'Personnel',            3,    1,    0,    'gratuit'),
  ('perso_famille',        'personnel',  'Famille',              null, 6,    2900, 'an'),
  ('entreprise_starter',   'entreprise', 'Entreprise Starter',   25,   10,   1900, 'mois'),
  ('entreprise_equipe',    'entreprise', 'Entreprise Équipe',    150,  50,   4900, 'mois'),
  ('atelier_contributeur', 'atelier',    'Atelier contributeur', 0,    3,    0,    'gratuit'),
  ('atelier_pro',          'atelier',    'Atelier Pro',          0,    25,   2900, 'mois')
on conflict (plan) do update
  set kind        = excluded.kind,
      label       = excluded.label,
      max_assets  = excluded.max_assets,
      max_members = excluded.max_members,
      price_cents = excluded.price_cents,
      period      = excluded.period,
      updated_at  = now();

alter table public.nid_plan_limits enable row level security;

drop policy if exists "nid_plan_limits_read" on public.nid_plan_limits;
create policy "nid_plan_limits_read" on public.nid_plan_limits
  for select using (true);

revoke insert, update, delete on table public.nid_plan_limits from anon, authenticated;

-- Journal des événements Stripe Nireo ID : un événement n'est traité
-- qu'une seule fois, même si Stripe le renvoie.
create table if not exists public.nid_stripe_events (
  event_id text primary key,
  type text not null default '',
  workspace_id uuid references public.nid_workspaces (id) on delete set null,
  processed_at timestamptz not null default now()
);

alter table public.nid_stripe_events enable row level security;
revoke all on table public.nid_stripe_events from anon, authenticated;

-- =============================================================
-- 3. Extension des téléphones (nid_assets)
-- =============================================================

alter table public.nid_assets
  add column if not exists workspace_id uuid references public.nid_workspaces (id) on delete set null;

alter table public.nid_assets
  add column if not exists fleet_status text not null default 'en_stock';

alter table public.nid_assets
  add column if not exists health_state text not null default 'bon_etat';

alter table public.nid_assets
  add column if not exists internal_reference text not null default '';

alter table public.nid_assets
  add column if not exists warranty_end date;

alter table public.nid_assets
  add column if not exists eprel_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nid_assets_fleet_status_check') then
    alter table public.nid_assets
      add constraint nid_assets_fleet_status_check check (fleet_status in (
        'en_stock', 'affecte', 'prete', 'en_reparation', 'retourne',
        'pret_a_vendre', 'vendu', 'recycle', 'perdu', 'declare_vole'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nid_assets_health_state_check') then
    alter table public.nid_assets
      add constraint nid_assets_health_state_check check (health_state in (
        'bon_etat', 'a_surveiller', 'probleme_declare', 'en_reparation'
      ));
  end if;
end
$$;

create index if not exists nid_assets_workspace_idx
  on public.nid_assets (workspace_id, created_at desc);
create index if not exists nid_assets_fleet_idx
  on public.nid_assets (workspace_id, fleet_status);

-- Colonnes de parc modifiables par un rôle autorisé (les empreintes, le
-- statut de transfert et l'identifiant public restent serveur).
grant update (fleet_status, internal_reference, warranty_end)
  on table public.nid_assets to authenticated;

-- =============================================================
-- 4. Provenance des événements
-- =============================================================
-- « Vérifié par Nireo » n'existe pas : seule la PROVENANCE est affichée.

alter table public.nid_events
  add column if not exists source_type text not null default 'declare_proprietaire';

alter table public.nid_events
  add column if not exists workspace_id uuid references public.nid_workspaces (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nid_events_source_type_check') then
    alter table public.nid_events
      add constraint nid_events_source_type_check check (source_type in (
        'declare_proprietaire', 'declare_detenteur', 'document_fourni',
        'atteste_reparateur', 'importe', 'mesure_diagnostic'
      ));
  end if;
end
$$;

-- Le navigateur ne choisit JAMAIS la provenance : la colonne n'est pas
-- ajoutée aux privilèges d'insertion (la valeur par défaut s'applique).

-- =============================================================
-- 5. Affectations (détenteur ≠ propriétaire)
-- =============================================================

create table if not exists public.nid_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  workspace_id uuid not null references public.nid_workspaces (id) on delete cascade,
  holder_user_id uuid references auth.users (id) on delete set null,
  holder_name text not null default '',
  holder_email text not null default '',
  kind text not null default 'affectation' check (kind in ('affectation', 'pret')),
  started_on date not null default current_date,
  ended_on date,
  status text not null default 'active' check (status in ('active', 'ended')),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule affectation normale active par téléphone et par entreprise.
create unique index if not exists nid_assignments_one_active
  on public.nid_assignments (asset_id, workspace_id)
  where status = 'active' and kind = 'affectation';

create index if not exists nid_assignments_asset_idx
  on public.nid_assignments (asset_id, started_on desc);
create index if not exists nid_assignments_holder_idx
  on public.nid_assignments (holder_user_id, status);
create index if not exists nid_assignments_email_idx
  on public.nid_assignments (lower(holder_email), status);

drop trigger if exists nid_assignments_updated_at on public.nid_assignments;
create trigger nid_assignments_updated_at
  before update on public.nid_assignments
  for each row execute function public.set_updated_at();

alter table public.nid_assignments enable row level security;

drop policy if exists "nid_assignments_select" on public.nid_assignments;
create policy "nid_assignments_select" on public.nid_assignments
  for select using (
    (select auth.uid()) = holder_user_id
    or public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer'])
  );

revoke insert, update, delete on table public.nid_assignments from anon, authenticated;

-- ---------- Lecture d'un téléphone par un membre d'espace ----------
-- Complète (sans la remplacer) la policy « propriétaire » de la V1 :
--  • owner / admin / manager / viewer voient le parc de leur espace ;
--  • member ne voit QUE le téléphone qui lui est affecté.

drop policy if exists "nid_assets_select_workspace" on public.nid_assets;
create policy "nid_assets_select_workspace" on public.nid_assets
  for select using (
    workspace_id is not null
    and (
      public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer'])
      or exists (
        select 1 from public.nid_assignments a
         where a.asset_id = nid_assets.id
           and a.status = 'active'
           and a.holder_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "nid_assets_update_workspace" on public.nid_assets;
create policy "nid_assets_update_workspace" on public.nid_assets
  for update using (
    workspace_id is not null
    and public.nid_has_role(workspace_id, array['owner', 'admin', 'manager'])
  )
  with check (
    workspace_id is not null
    and public.nid_has_role(workspace_id, array['owner', 'admin', 'manager'])
  );

-- Historique visible dans l'espace (le membre simple voit l'historique du
-- téléphone qui lui est affecté, jamais celui des autres).
drop policy if exists "nid_events_select_workspace" on public.nid_events;
create policy "nid_events_select_workspace" on public.nid_events
  for select using (
    exists (
      select 1 from public.nid_assets a
       where a.id = nid_events.asset_id
         and a.workspace_id is not null
         and (
           public.nid_has_role(a.workspace_id, array['owner', 'admin', 'manager', 'viewer'])
           or exists (
             select 1 from public.nid_assignments asg
              where asg.asset_id = a.id
                and asg.status = 'active'
                and asg.holder_user_id = (select auth.uid())
           )
         )
    )
  );

drop policy if exists "nid_media_select_workspace" on public.nid_media;
create policy "nid_media_select_workspace" on public.nid_media
  for select using (
    exists (
      select 1 from public.nid_assets a
       where a.id = nid_media.asset_id
         and a.workspace_id is not null
         and public.nid_has_role(a.workspace_id, array['owner', 'admin', 'manager', 'viewer'])
    )
  );

-- =============================================================
-- 6. Bilans (planification, demandes, réponses, campagnes)
-- =============================================================

create table if not exists public.nid_check_schedules (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references public.nid_assets (id) on delete cascade,
  workspace_id uuid references public.nid_workspaces (id) on delete cascade,
  frequency_months smallint not null default 1 check (frequency_months between 1 and 12),
  full_check_every smallint not null default 3 check (full_check_every between 1 and 12),
  enabled boolean not null default true,
  next_due_on date not null default (current_date + 30),
  last_request_at timestamptz,
  last_answer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_schedules_due_idx
  on public.nid_check_schedules (next_due_on) where enabled;

drop trigger if exists nid_schedules_updated_at on public.nid_check_schedules;
create trigger nid_schedules_updated_at
  before update on public.nid_check_schedules
  for each row execute function public.set_updated_at();

create table if not exists public.nid_check_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.nid_workspaces (id) on delete cascade,
  label text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'en_cours' check (status in ('en_cours', 'terminee')),
  total integer not null default 0,
  sent integer not null default 0,
  manual integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists nid_campaigns_workspace_idx
  on public.nid_check_campaigns (workspace_id, created_at desc);

create table if not exists public.nid_check_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  workspace_id uuid references public.nid_workspaces (id) on delete set null,
  campaign_id uuid references public.nid_check_campaigns (id) on delete set null,
  recipient_user_id uuid references auth.users (id) on delete set null,
  recipient_name text not null default '',
  recipient_email text not null,
  -- SHA-256 du jeton : le jeton brut ne vit que dans le lien envoyé.
  token_hash text not null unique,
  scope text not null default 'mini' check (scope in ('mini', 'complet')),
  due_on date not null default current_date,
  expires_at timestamptz not null,
  sent_at timestamptz,
  email_status text not null default 'en_attente'
    check (email_status in ('en_attente', 'envoye', 'echec', 'manuel')),
  email_error text not null default '',
  first_used_at timestamptz,
  answered_at timestamptz,
  revoked_at timestamptz,
  checkup_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Idempotence du planificateur : une seule demande vivante par téléphone
-- et par échéance, même si le cron est relancé.
create unique index if not exists nid_check_requests_dedupe
  on public.nid_check_requests (asset_id, due_on)
  where revoked_at is null;

create index if not exists nid_check_requests_asset_idx
  on public.nid_check_requests (asset_id, created_at desc);
create index if not exists nid_check_requests_workspace_idx
  on public.nid_check_requests (workspace_id, answered_at, due_on);
create index if not exists nid_check_requests_campaign_idx
  on public.nid_check_requests (campaign_id);

create table if not exists public.nid_checkups (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  request_id uuid references public.nid_check_requests (id) on delete set null,
  workspace_id uuid references public.nid_workspaces (id) on delete set null,
  responder_user_id uuid references auth.users (id) on delete set null,
  responder_label text not null default '',
  answer text not null check (answer in (
    'tout_fonctionne', 'probleme', 'repare', 'plus_detenu'
  )),
  details jsonb not null default '{}'::jsonb,
  comment text not null default '',
  source_type text not null default 'declare_detenteur'
    check (source_type in ('declare_proprietaire', 'declare_detenteur')),
  event_id uuid references public.nid_events (id) on delete set null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists nid_checkups_asset_idx
  on public.nid_checkups (asset_id, answered_at desc);
create index if not exists nid_checkups_workspace_idx
  on public.nid_checkups (workspace_id, answered_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nid_check_requests_checkup_fkey'
  ) then
    alter table public.nid_check_requests
      add constraint nid_check_requests_checkup_fkey
      foreign key (checkup_id) references public.nid_checkups (id) on delete set null;
  end if;
end
$$;

alter table public.nid_check_schedules enable row level security;
alter table public.nid_check_campaigns enable row level security;
alter table public.nid_check_requests enable row level security;
alter table public.nid_checkups enable row level security;

drop policy if exists "nid_schedules_select" on public.nid_check_schedules;
create policy "nid_schedules_select" on public.nid_check_schedules
  for select using (
    public.nid_owns(asset_id)
    or (workspace_id is not null
        and public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer']))
  );

drop policy if exists "nid_campaigns_select" on public.nid_check_campaigns;
create policy "nid_campaigns_select" on public.nid_check_campaigns
  for select using (
    public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer'])
  );

-- Le jeton haché n'est jamais lisible par le navigateur (cf. grants colonne).
drop policy if exists "nid_check_requests_select" on public.nid_check_requests;
create policy "nid_check_requests_select" on public.nid_check_requests
  for select using (
    public.nid_owns(asset_id)
    or (select auth.uid()) = recipient_user_id
    or (workspace_id is not null
        and public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer']))
  );

drop policy if exists "nid_checkups_select" on public.nid_checkups;
create policy "nid_checkups_select" on public.nid_checkups
  for select using (
    public.nid_owns(asset_id)
    or (select auth.uid()) = responder_user_id
    or (workspace_id is not null
        and public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer']))
  );

revoke insert, update, delete on table public.nid_check_schedules from anon, authenticated;
revoke insert, update, delete on table public.nid_check_campaigns from anon, authenticated;
revoke insert, update, delete on table public.nid_check_requests from anon, authenticated;
revoke insert, update, delete on table public.nid_checkups from anon, authenticated;

-- Le jeton haché reste invisible même en lecture : on retire la colonne
-- des privilèges SELECT du rôle applicatif.
revoke select on table public.nid_check_requests from anon, authenticated;
grant select (
  id, asset_id, workspace_id, campaign_id, recipient_user_id, recipient_name,
  recipient_email, scope, due_on, expires_at, sent_at, email_status, email_error,
  first_used_at, answered_at, revoked_at, checkup_id, created_by, created_at
) on table public.nid_check_requests to authenticated;

-- =============================================================
-- 7. Réparations
-- =============================================================

create table if not exists public.nid_repair_orders (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.nid_assets (id) on delete cascade,
  -- Espace demandeur (entreprise ou espace personnel du propriétaire).
  workspace_id uuid references public.nid_workspaces (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  -- Atelier : espace Nireo (facultatif) et/ou identité professionnelle.
  repairer_workspace_id uuid references public.nid_workspaces (id) on delete set null,
  professional_id uuid references public.nid_professional_profiles (id) on delete set null,
  repairer_label text not null default '',

  status text not null default 'a_diagnostiquer' check (status in (
    'a_diagnostiquer', 'en_cours', 'en_attente_validation', 'termine', 'annule'
  )),
  reported_problem text not null default '',
  visual_state text not null default '',
  diagnosis text not null default '',
  operation text not null default '',
  parts text not null default '',
  parts_type text not null default 'inconnu'
    check (parts_type in ('origine', 'compatible', 'reconditionne', 'inconnu')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  warranty_months smallint check (warranty_months is null or warranty_months between 0 and 120),
  intervened_on date,
  comment text not null default '',

  -- Lien temporaire remis à l'atelier (jeton haché, expirant, révocable).
  token_hash text unique,
  expires_at timestamptz,
  claimed_at timestamptz,
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references auth.users (id) on delete set null,
  refused_at timestamptz,
  refusal_reason text not null default '',
  event_id uuid references public.nid_events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nid_repairs_asset_idx
  on public.nid_repair_orders (asset_id, created_at desc);
create index if not exists nid_repairs_workspace_idx
  on public.nid_repair_orders (workspace_id, status);
create index if not exists nid_repairs_repairer_idx
  on public.nid_repair_orders (repairer_workspace_id, status, created_at desc);
create index if not exists nid_repairs_pro_idx
  on public.nid_repair_orders (professional_id, status);

drop trigger if exists nid_repairs_updated_at on public.nid_repair_orders;
create trigger nid_repairs_updated_at
  before update on public.nid_repair_orders
  for each row execute function public.set_updated_at();

alter table public.nid_repair_orders enable row level security;

drop policy if exists "nid_repairs_select" on public.nid_repair_orders;
create policy "nid_repairs_select" on public.nid_repair_orders
  for select using (
    public.nid_owns(asset_id)
    or (workspace_id is not null
        and public.nid_has_role(workspace_id, array['owner', 'admin', 'manager', 'viewer']))
    or (repairer_workspace_id is not null
        and public.nid_is_member(repairer_workspace_id))
    or professional_id in (
      select p.id from public.nid_professional_profiles p
       where p.user_id = (select auth.uid())
    )
  );

revoke insert, update, delete on table public.nid_repair_orders from anon, authenticated;
revoke select on table public.nid_repair_orders from anon, authenticated;
grant select (
  id, asset_id, workspace_id, requested_by, repairer_workspace_id, professional_id,
  repairer_label, status, reported_problem, visual_state, diagnosis, operation,
  parts, parts_type, amount_cents, warranty_months, intervened_on, comment,
  expires_at, claimed_at, submitted_at, validated_at, validated_by, refused_at,
  refusal_reason, event_id, created_at, updated_at
) on table public.nid_repair_orders to authenticated;

-- =============================================================
-- 8. Fonctions serveur
-- =============================================================

-- ---------- Espace personnel : création atomique et idempotente ----------
create or replace function public.nid_ensure_personal_workspace(
  p_user_id uuid,
  p_name text default 'Mon espace'
)
returns uuid
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'Utilisateur manquant.';
  end if;

  select w.id into v_id
    from public.nid_workspaces w
   where w.owner_user_id = p_user_id and w.kind = 'personnel';

  if v_id is null then
    insert into public.nid_workspaces (kind, name, owner_user_id, plan)
    values ('personnel', coalesce(nullif(trim(p_name), ''), 'Mon espace'), p_user_id, 'perso_gratuit')
    on conflict do nothing
    returning id into v_id;

    -- Course entre deux requêtes simultanées : on relit.
    if v_id is null then
      select w.id into v_id
        from public.nid_workspaces w
       where w.owner_user_id = p_user_id and w.kind = 'personnel';
    end if;
  end if;

  insert into public.nid_workspace_members (workspace_id, user_id, role, status)
  values (v_id, p_user_id, 'owner', 'actif')
  on conflict do nothing;

  -- Rattrapage : les téléphones créés avant les espaces rejoignent le sien.
  update public.nid_assets a
     set workspace_id = v_id
   where a.current_owner_id = p_user_id and a.workspace_id is null;

  return v_id;
end;
$$;

revoke all on function public.nid_ensure_personal_workspace(uuid, text) from public, anon, authenticated;

-- ---------- Création d'une entreprise ou d'un atelier ----------
create or replace function public.nid_create_workspace(
  p_user_id uuid,
  p_kind text,
  p_name text
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_plan text := case when p_kind = 'atelier' then 'atelier_contributeur' else 'entreprise_starter' end;
begin
  if p_kind not in ('entreprise', 'atelier') then
    raise exception 'Type d''espace invalide.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nom d''espace requis.';
  end if;

  insert into public.nid_workspaces (kind, name, owner_user_id, plan)
  values (p_kind, trim(p_name), p_user_id, v_plan)
  returning id into v_id;

  insert into public.nid_workspace_members (workspace_id, user_id, role, status)
  values (v_id, p_user_id, 'owner', 'actif');

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, metadata)
  values (p_user_id, 'utilisateur', 'workspace.created', 'workspace', v_id,
          jsonb_build_object('kind', p_kind));

  return jsonb_build_object('id', v_id, 'kind', p_kind);
end;
$$;

revoke all on function public.nid_create_workspace(uuid, text, text) from public, anon, authenticated;

-- ---------- Invitation : acceptation atomique ----------
create or replace function public.nid_accept_invite(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_invite public.nid_workspace_invites;
begin
  select * into v_invite
    from public.nid_workspace_invites i
   where i.token_hash = p_token_hash
   for update;

  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_invite.revoked_at is not null then
    return jsonb_build_object('state', 'revoque');
  end if;
  if v_invite.accepted_at is not null then
    return jsonb_build_object('state', 'deja_utilise', 'workspace_id', v_invite.workspace_id);
  end if;
  if v_invite.expires_at <= now() then
    return jsonb_build_object('state', 'expire');
  end if;
  if lower(coalesce(p_email, '')) <> lower(v_invite.email) then
    return jsonb_build_object('state', 'destinataire_different');
  end if;

  insert into public.nid_workspace_members (workspace_id, user_id, email, role, status)
  values (v_invite.workspace_id, p_user_id, lower(v_invite.email), v_invite.role, 'actif')
  on conflict (workspace_id, user_id) where user_id is not null
  do update set status = 'actif', role = excluded.role;

  -- Un salarié pré-enregistré par e-mail seul rejoint son compte.
  update public.nid_workspace_members m
     set status = 'retire'
   where m.workspace_id = v_invite.workspace_id
     and m.user_id is null
     and lower(m.email) = lower(v_invite.email);

  update public.nid_assignments a
     set holder_user_id = p_user_id
   where a.workspace_id = v_invite.workspace_id
     and a.holder_user_id is null
     and lower(a.holder_email) = lower(v_invite.email)
     and a.status = 'active';

  update public.nid_workspace_invites
     set accepted_at = now(), accepted_by = p_user_id
   where id = v_invite.id;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, metadata)
  values (p_user_id, 'utilisateur', 'workspace.invite_accepted', 'workspace', v_invite.workspace_id,
          jsonb_build_object('role', v_invite.role));

  return jsonb_build_object('state', 'accepte', 'workspace_id', v_invite.workspace_id);
end;
$$;

revoke all on function public.nid_accept_invite(text, uuid, text) from public, anon, authenticated;

-- ---------- Quota serveur ----------
create or replace function public.nid_check_asset_quota(p_workspace uuid)
returns void
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_plan text;
  v_max integer;
  v_count integer;
begin
  if p_workspace is null then return; end if;

  select w.plan into v_plan from public.nid_workspaces w where w.id = p_workspace;
  if v_plan is null then return; end if;

  select l.max_assets into v_max from public.nid_plan_limits l where l.plan = v_plan;
  if v_max is null then return; end if;

  select count(*) into v_count
    from public.nid_assets a
   where a.workspace_id = p_workspace and a.status <> 'archived';

  if v_count >= v_max then
    raise exception 'QUOTA_REACHED:%', v_max;
  end if;
end;
$$;

revoke all on function public.nid_check_asset_quota(uuid) from public, anon, authenticated;

-- ---------- Ajout d'un téléphone (V2 : espace, garantie, bilan) ----------
-- Réutilise intégralement `nid_create_asset` (V1) puis complète la fiche.
-- Le tout dans une seule transaction : rien de partiel n'est enregistré.
create or replace function public.nid_create_asset_v2(
  p_owner_id uuid,
  p_asset_id uuid,
  p_workspace_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_result jsonb;
  v_frequency smallint := coalesce((p_payload ->> 'check_frequency_months')::smallint, 1);
  v_next date;
begin
  if p_workspace_id is not null then
    if not exists (
      select 1 from public.nid_workspace_members m
       where m.workspace_id = p_workspace_id
         and m.user_id = p_owner_id
         and m.status = 'actif'
         and m.role in ('owner', 'admin', 'manager')
    ) then
      raise exception 'WORKSPACE_FORBIDDEN';
    end if;
    perform public.nid_check_asset_quota(p_workspace_id);
  end if;

  v_result := public.nid_create_asset(p_owner_id, p_asset_id, p_payload);

  update public.nid_assets a
     set workspace_id       = p_workspace_id,
         fleet_status       = coalesce(nullif(p_payload ->> 'fleet_status', ''), 'en_stock'),
         internal_reference = coalesce(p_payload ->> 'internal_reference', ''),
         warranty_end       = nullif(p_payload ->> 'warranty_end', '')::date,
         eprel_url          = nullif(p_payload ->> 'eprel_url', '')
   where a.id = p_asset_id;

  update public.nid_events e
     set source_type = 'declare_proprietaire',
         workspace_id = p_workspace_id
   where e.asset_id = p_asset_id;

  v_next := current_date + (v_frequency * 30);

  insert into public.nid_check_schedules (asset_id, workspace_id, frequency_months, next_due_on)
  values (p_asset_id, p_workspace_id, greatest(1, least(12, v_frequency)), v_next)
  on conflict (asset_id) do update
    set workspace_id = excluded.workspace_id,
        frequency_months = excluded.frequency_months;

  return v_result || jsonb_build_object('next_check_on', v_next);
end;
$$;

revoke all on function public.nid_create_asset_v2(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- Affectation d'un téléphone à un détenteur ----------
-- Un changement de détenteur ne crée JAMAIS un transfert de propriété.
create or replace function public.nid_assign_asset(
  p_actor_id uuid,
  p_asset_id uuid,
  p_workspace_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_holder text := coalesce(nullif(trim(p_payload ->> 'holder_name'), ''), '');
  v_email text := lower(coalesce(nullif(trim(p_payload ->> 'holder_email'), ''), ''));
  v_user uuid := nullif(p_payload ->> 'holder_user_id', '')::uuid;
  v_kind text := coalesce(nullif(p_payload ->> 'kind', ''), 'affectation');
begin
  if not exists (
    select 1 from public.nid_workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = p_actor_id
       and m.status = 'actif'
       and m.role in ('owner', 'admin', 'manager')
  ) then
    return jsonb_build_object('state', 'non_autorise');
  end if;

  if not exists (
    select 1 from public.nid_assets a
     where a.id = p_asset_id and a.workspace_id = p_workspace_id
  ) then
    return jsonb_build_object('state', 'telephone_introuvable');
  end if;

  if v_holder = '' and v_user is null then
    return jsonb_build_object('state', 'detenteur_manquant');
  end if;

  -- Clôture de l'affectation active précédente (le retour ne change rien
  -- à la propriété).
  update public.nid_assignments
     set status = 'ended', ended_on = current_date
   where asset_id = p_asset_id
     and workspace_id = p_workspace_id
     and status = 'active'
     and kind = v_kind;

  insert into public.nid_assignments (
    asset_id, workspace_id, holder_user_id, holder_name, holder_email,
    kind, started_on, note, created_by
  ) values (
    p_asset_id, p_workspace_id, v_user, v_holder, v_email, v_kind,
    coalesce(nullif(p_payload ->> 'started_on', '')::date, current_date),
    coalesce(p_payload ->> 'note', ''), p_actor_id
  )
  returning id into v_assignment_id;

  update public.nid_assets
     set fleet_status = case when v_kind = 'pret' then 'prete' else 'affecte' end
   where id = p_asset_id;

  -- L'événement ne contient JAMAIS le nom du détenteur : cette donnée
  -- reste dans `nid_assignments`, hors de tout rapport partagé.
  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, author_label, trust_level, source_type, workspace_id
  ) values (
    p_asset_id, 'autre', current_date,
    case when v_kind = 'pret' then 'Téléphone prêté' else 'Téléphone affecté' end,
    'Changement de détenteur au sein de l''entreprise. La propriété est inchangée.',
    p_actor_id, 'proprietaire', '', 0, 'declare_proprietaire', p_workspace_id
  );

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
  values (p_actor_id, 'utilisateur', 'assignment.created', 'assignment', v_assignment_id, p_asset_id);

  return jsonb_build_object('state', 'affecte', 'assignment_id', v_assignment_id);
end;
$$;

revoke all on function public.nid_assign_asset(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.nid_end_assignment(
  p_actor_id uuid,
  p_assignment_id uuid,
  p_fleet_status text default 'en_stock'
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_row public.nid_assignments;
begin
  select * into v_row from public.nid_assignments a where a.id = p_assignment_id for update;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if not exists (
    select 1 from public.nid_workspace_members m
     where m.workspace_id = v_row.workspace_id
       and m.user_id = p_actor_id
       and m.status = 'actif'
       and m.role in ('owner', 'admin', 'manager')
  ) then
    return jsonb_build_object('state', 'non_autorise');
  end if;
  if v_row.status = 'ended' then
    return jsonb_build_object('state', 'deja_termine');
  end if;

  update public.nid_assignments
     set status = 'ended', ended_on = current_date
   where id = p_assignment_id;

  update public.nid_assets
     set fleet_status = coalesce(nullif(p_fleet_status, ''), 'en_stock')
   where id = v_row.asset_id;

  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, trust_level, source_type, workspace_id
  ) values (
    v_row.asset_id, 'autre', current_date, 'Téléphone rendu',
    'Retour du téléphone dans l''entreprise. La propriété est inchangée.',
    p_actor_id, 'proprietaire', 0, 'declare_proprietaire', v_row.workspace_id
  );

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
  values (p_actor_id, 'utilisateur', 'assignment.ended', 'assignment', p_assignment_id, v_row.asset_id);

  return jsonb_build_object('state', 'termine');
end;
$$;

revoke all on function public.nid_end_assignment(uuid, uuid, text) from public, anon, authenticated;

-- ---------- Demande de bilan (création idempotente) ----------
create or replace function public.nid_create_check_request(
  p_asset_id uuid,
  p_token_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_due date := coalesce(nullif(p_payload ->> 'due_on', '')::date, current_date);
  v_existing public.nid_check_requests;
begin
  select * into v_existing
    from public.nid_check_requests r
   where r.asset_id = p_asset_id and r.due_on = v_due and r.revoked_at is null;

  if found then
    -- Relance du cron ou double clic : aucune seconde demande, aucun
    -- second e-mail. On renvoie la demande existante.
    return jsonb_build_object('state', 'existante', 'id', v_existing.id,
                              'answered', v_existing.answered_at is not null);
  end if;

  insert into public.nid_check_requests (
    asset_id, workspace_id, campaign_id, recipient_user_id, recipient_name,
    recipient_email, token_hash, scope, due_on, expires_at, created_by
  ) values (
    p_asset_id,
    nullif(p_payload ->> 'workspace_id', '')::uuid,
    nullif(p_payload ->> 'campaign_id', '')::uuid,
    nullif(p_payload ->> 'recipient_user_id', '')::uuid,
    coalesce(p_payload ->> 'recipient_name', ''),
    lower(p_payload ->> 'recipient_email'),
    p_token_hash,
    coalesce(nullif(p_payload ->> 'scope', ''), 'mini'),
    v_due,
    coalesce(nullif(p_payload ->> 'expires_at', '')::timestamptz, now() + interval '45 days'),
    nullif(p_payload ->> 'created_by', '')::uuid
  )
  returning id into v_id;

  update public.nid_check_schedules
     set last_request_at = now()
   where asset_id = p_asset_id;

  return jsonb_build_object('state', 'creee', 'id', v_id);
end;
$$;

revoke all on function public.nid_create_check_request(uuid, text, jsonb) from public, anon, authenticated;

-- ---------- Réponse à un bilan (jeton) ----------
-- Idempotente : une double soumission ne crée pas deux réponses.
create or replace function public.nid_answer_checkup(
  p_token_hash text,
  p_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_request public.nid_check_requests;
  v_asset public.nid_assets;
  v_checkup_id uuid;
  v_event_id uuid;
  v_answer text := p_payload ->> 'answer';
  v_details jsonb := coalesce(p_payload -> 'details', '{}'::jsonb);
  v_comment text := left(coalesce(p_payload ->> 'comment', ''), 1000);
  v_title text;
  v_health text;
  v_schedule public.nid_check_schedules;
begin
  if v_answer not in ('tout_fonctionne', 'probleme', 'repare', 'plus_detenu') then
    return jsonb_build_object('state', 'reponse_invalide');
  end if;

  select * into v_request
    from public.nid_check_requests r
   where r.token_hash = p_token_hash
   for update;

  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_request.revoked_at is not null then
    return jsonb_build_object('state', 'revoque');
  end if;
  if v_request.answered_at is not null then
    return jsonb_build_object('state', 'deja_repondu', 'checkup_id', v_request.checkup_id);
  end if;
  if v_request.expires_at <= now() then
    return jsonb_build_object('state', 'expire');
  end if;

  select * into v_asset from public.nid_assets a where a.id = v_request.asset_id;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;

  v_title := case v_answer
    when 'tout_fonctionne' then 'Bilan : tout fonctionne'
    when 'probleme'        then 'Bilan : problème constaté'
    when 'repare'          then 'Bilan : téléphone réparé'
    else 'Bilan : téléphone plus détenu'
  end;

  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, author_label, trust_level, source_type, workspace_id, metadata
  ) values (
    v_request.asset_id, 'controle_etat', current_date, v_title, v_comment,
    p_user_id, 'proprietaire',
    -- Jamais le nom du répondant : un rapport partagé ne doit pas
    -- identifier un salarié. La provenance suffit.
    '',
    0,
    case when v_request.workspace_id is null then 'declare_proprietaire' else 'declare_detenteur' end,
    v_request.workspace_id,
    v_details
  )
  returning id into v_event_id;

  insert into public.nid_checkups (
    asset_id, request_id, workspace_id, responder_user_id, responder_label,
    answer, details, comment, source_type, event_id
  ) values (
    v_request.asset_id, v_request.id, v_request.workspace_id, p_user_id,
    coalesce(nullif(v_request.recipient_name, ''), v_request.recipient_email),
    v_answer, v_details, v_comment,
    case when v_request.workspace_id is null then 'declare_proprietaire' else 'declare_detenteur' end,
    v_event_id
  )
  returning id into v_checkup_id;

  update public.nid_check_requests
     set answered_at = now(),
         checkup_id = v_checkup_id,
         first_used_at = coalesce(first_used_at, now())
   where id = v_request.id;

  v_health := case v_answer
    when 'tout_fonctionne' then 'bon_etat'
    when 'probleme'        then 'probleme_declare'
    when 'repare'          then 'bon_etat'
    else v_asset.health_state
  end;

  update public.nid_assets
     set health_state = v_health,
         fleet_status = case when v_answer = 'plus_detenu' and v_asset.workspace_id is not null
                             then 'perdu' else fleet_status end
   where id = v_request.asset_id;

  -- Prochaine échéance : jamais deux relances pour le même mois.
  select * into v_schedule from public.nid_check_schedules s where s.asset_id = v_request.asset_id;
  if found then
    update public.nid_check_schedules
       set last_answer_at = now(),
           next_due_on = greatest(
             current_date + 1,
             current_date + (v_schedule.frequency_months * 30)
           )
     where asset_id = v_request.asset_id;
  end if;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_user_id, case when p_user_id is null then 'systeme' else 'utilisateur' end,
          'checkup.answered', 'checkup', v_checkup_id, v_request.asset_id,
          jsonb_build_object('answer', v_answer));

  return jsonb_build_object(
    'state', 'enregistre',
    'checkup_id', v_checkup_id,
    'asset_id', v_request.asset_id,
    'answer', v_answer
  );
end;
$$;

revoke all on function public.nid_answer_checkup(text, uuid, jsonb) from public, anon, authenticated;

-- ---------- Bilan rempli par le propriétaire lui-même ----------
-- Même écriture que `nid_answer_checkup`, mais l'autorisation vient de la
-- PROPRIÉTÉ (ou d'un rôle de gestion) et non d'un jeton : c'est le chemin
-- utilisé par le bouton « Faire le bilan » dans l'application.
create or replace function public.nid_answer_checkup_owner(
  p_user_id uuid,
  p_asset_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_asset public.nid_assets;
  v_checkup_id uuid;
  v_event_id uuid;
  v_request_id uuid;
  v_answer text := p_payload ->> 'answer';
  v_details jsonb := coalesce(p_payload -> 'details', '{}'::jsonb);
  v_comment text := left(coalesce(p_payload ->> 'comment', ''), 1000);
  v_title text;
  v_health text;
  v_schedule public.nid_check_schedules;
begin
  if v_answer not in ('tout_fonctionne', 'probleme', 'repare', 'plus_detenu') then
    return jsonb_build_object('state', 'reponse_invalide');
  end if;

  select * into v_asset from public.nid_assets a where a.id = p_asset_id for update;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;

  if v_asset.current_owner_id is distinct from p_user_id
     and not exists (
       select 1 from public.nid_workspace_members m
        where m.workspace_id = v_asset.workspace_id
          and m.user_id = p_user_id
          and m.status = 'actif'
          and m.role in ('owner', 'admin', 'manager')
     )
     and not exists (
       select 1 from public.nid_assignments asg
        where asg.asset_id = p_asset_id
          and asg.status = 'active'
          and asg.holder_user_id = p_user_id
     )
  then
    return jsonb_build_object('state', 'non_autorise');
  end if;

  v_title := case v_answer
    when 'tout_fonctionne' then 'Bilan : tout fonctionne'
    when 'probleme'        then 'Bilan : problème constaté'
    when 'repare'          then 'Bilan : téléphone réparé'
    else 'Bilan : téléphone plus détenu'
  end;

  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, trust_level, source_type, workspace_id, metadata
  ) values (
    p_asset_id, 'controle_etat', current_date, v_title, v_comment,
    p_user_id, 'proprietaire', 0,
    case when v_asset.current_owner_id = p_user_id
         then 'declare_proprietaire' else 'declare_detenteur' end,
    v_asset.workspace_id, v_details
  )
  returning id into v_event_id;

  insert into public.nid_checkups (
    asset_id, workspace_id, responder_user_id, answer, details, comment,
    source_type, event_id
  ) values (
    p_asset_id, v_asset.workspace_id, p_user_id, v_answer, v_details, v_comment,
    case when v_asset.current_owner_id = p_user_id
         then 'declare_proprietaire' else 'declare_detenteur' end,
    v_event_id
  )
  returning id into v_checkup_id;

  -- Une demande ouverte pour ce téléphone est considérée comme traitée :
  -- aucun rappel ne partira ensuite pour la même échéance.
  select r.id into v_request_id
    from public.nid_check_requests r
   where r.asset_id = p_asset_id
     and r.answered_at is null
     and r.revoked_at is null
   order by r.due_on
   limit 1;

  if v_request_id is not null then
    update public.nid_check_requests
       set answered_at = now(), checkup_id = v_checkup_id
     where id = v_request_id;
    update public.nid_checkups set request_id = v_request_id where id = v_checkup_id;
  end if;

  v_health := case v_answer
    when 'tout_fonctionne' then 'bon_etat'
    when 'probleme'        then 'probleme_declare'
    when 'repare'          then 'bon_etat'
    else v_asset.health_state
  end;

  update public.nid_assets set health_state = v_health where id = p_asset_id;

  select * into v_schedule from public.nid_check_schedules s where s.asset_id = p_asset_id;
  if found then
    update public.nid_check_schedules
       set last_answer_at = now(),
           next_due_on = current_date + (v_schedule.frequency_months * 30)
     where asset_id = p_asset_id;
  end if;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_user_id, 'utilisateur', 'checkup.answered', 'checkup', v_checkup_id, p_asset_id,
          jsonb_build_object('answer', v_answer, 'origin', 'application'));

  return jsonb_build_object('state', 'enregistre', 'checkup_id', v_checkup_id, 'answer', v_answer);
end;
$$;

revoke all on function public.nid_answer_checkup_owner(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- Réparation : création d'une demande ----------
create or replace function public.nid_create_repair_order(
  p_actor_id uuid,
  p_asset_id uuid,
  p_token_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_workspace uuid;
begin
  select a.workspace_id into v_workspace from public.nid_assets a where a.id = p_asset_id;

  -- Autorisation : propriétaire du téléphone OU rôle de gestion dans
  -- l'espace propriétaire.
  if not exists (
    select 1 from public.nid_assets a
     where a.id = p_asset_id and a.current_owner_id = p_actor_id
  ) and not exists (
    select 1 from public.nid_workspace_members m
     where m.workspace_id = v_workspace
       and m.user_id = p_actor_id
       and m.status = 'actif'
       and m.role in ('owner', 'admin', 'manager')
  ) then
    return jsonb_build_object('state', 'non_autorise');
  end if;

  insert into public.nid_repair_orders (
    asset_id, workspace_id, requested_by, reported_problem, token_hash, expires_at
  ) values (
    p_asset_id, v_workspace, p_actor_id,
    left(coalesce(p_payload ->> 'reported_problem', ''), 2000),
    p_token_hash,
    coalesce(nullif(p_payload ->> 'expires_at', '')::timestamptz, now() + interval '30 days')
  )
  returning id into v_id;

  update public.nid_assets set fleet_status = 'en_reparation', health_state = 'en_reparation'
   where id = p_asset_id and workspace_id is not null;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
  values (p_actor_id, 'utilisateur', 'repair.created', 'repair_order', v_id, p_asset_id);

  return jsonb_build_object('state', 'creee', 'id', v_id);
end;
$$;

revoke all on function public.nid_create_repair_order(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ---------- Réparation : l'atelier prend l'intervention ----------
create or replace function public.nid_claim_repair_order(
  p_token_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_order public.nid_repair_orders;
  v_pro public.nid_professional_profiles;
  v_workspace uuid;
  v_workspace_name text;
  v_label text := '';
begin
  select * into v_order
    from public.nid_repair_orders o
   where o.token_hash = p_token_hash
   for update;

  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_order.status in ('termine', 'annule') then
    return jsonb_build_object('state', 'cloture');
  end if;
  if v_order.expires_at is not null and v_order.expires_at <= now() then
    return jsonb_build_object('state', 'expire');
  end if;
  if v_order.requested_by = p_user_id then
    return jsonb_build_object('state', 'auto_intervention');
  end if;

  select * into v_pro
    from public.nid_professional_profiles p
   where p.user_id = p_user_id;
  if found then
    v_label := v_pro.trade_name;
  end if;

  select w.id, w.name into v_workspace, v_workspace_name
    from public.nid_workspaces w
    join public.nid_workspace_members m on m.workspace_id = w.id
   where w.kind = 'atelier' and m.user_id = p_user_id and m.status = 'actif'
   order by w.created_at
   limit 1;

  v_label := coalesce(nullif(v_workspace_name, ''), v_label);

  if v_workspace is null and v_pro.id is null then
    -- Ni atelier Nireo, ni identité professionnelle : rien à rattacher.
    return jsonb_build_object('state', 'atelier_requis');
  end if;

  update public.nid_repair_orders
     set repairer_workspace_id = coalesce(v_workspace, repairer_workspace_id),
         professional_id = coalesce(v_pro.id, professional_id),
         repairer_label = coalesce(nullif(v_label, ''), repairer_label),
         claimed_at = coalesce(claimed_at, now()),
         status = case when status = 'a_diagnostiquer' then 'en_cours' else status end
   where id = v_order.id;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
  values (p_user_id, 'professionnel', 'repair.claimed', 'repair_order', v_order.id, v_order.asset_id);

  return jsonb_build_object('state', 'ouvert', 'id', v_order.id, 'asset_id', v_order.asset_id);
end;
$$;

revoke all on function public.nid_claim_repair_order(text, uuid) from public, anon, authenticated;

-- ---------- Réparation : soumission par l'atelier ----------
create or replace function public.nid_submit_repair_order(
  p_user_id uuid,
  p_order_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_order public.nid_repair_orders;
  v_allowed boolean := false;
begin
  select * into v_order from public.nid_repair_orders o where o.id = p_order_id for update;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;
  if v_order.status in ('termine', 'annule') then
    return jsonb_build_object('state', 'cloture');
  end if;
  if v_order.expires_at is not null and v_order.expires_at <= now() then
    return jsonb_build_object('state', 'expire');
  end if;

  if v_order.repairer_workspace_id is not null and exists (
    select 1 from public.nid_workspace_members m
     where m.workspace_id = v_order.repairer_workspace_id
       and m.user_id = p_user_id and m.status = 'actif'
  ) then
    v_allowed := true;
  end if;
  if not v_allowed and v_order.professional_id is not null and exists (
    select 1 from public.nid_professional_profiles p
     where p.id = v_order.professional_id and p.user_id = p_user_id
  ) then
    v_allowed := true;
  end if;
  if not v_allowed then
    return jsonb_build_object('state', 'non_autorise');
  end if;

  update public.nid_repair_orders
     set visual_state    = left(coalesce(p_payload ->> 'visual_state', ''), 1000),
         diagnosis       = left(coalesce(p_payload ->> 'diagnosis', ''), 2000),
         operation       = left(coalesce(p_payload ->> 'operation', ''), 2000),
         parts           = left(coalesce(p_payload ->> 'parts', ''), 500),
         parts_type      = coalesce(nullif(p_payload ->> 'parts_type', ''), 'inconnu'),
         amount_cents    = nullif(p_payload ->> 'amount_cents', '')::integer,
         warranty_months = nullif(p_payload ->> 'warranty_months', '')::smallint,
         intervened_on   = coalesce(nullif(p_payload ->> 'intervened_on', '')::date, current_date),
         comment         = left(coalesce(p_payload ->> 'comment', ''), 1000),
         status          = 'en_attente_validation',
         submitted_at    = now()
   where id = p_order_id;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
  values (p_user_id, 'professionnel', 'repair.submitted', 'repair_order', p_order_id, v_order.asset_id);

  return jsonb_build_object('state', 'soumis');
end;
$$;

revoke all on function public.nid_submit_repair_order(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- Réparation : validation par le client ----------
-- L'événement porte « Attesté par un réparateur » UNIQUEMENT si l'identité
-- professionnelle rattachée est approuvée ; sinon « Intervention déclarée
-- par l'atelier ».
create or replace function public.nid_validate_repair_order(
  p_user_id uuid,
  p_order_id uuid,
  p_decision text,
  p_reason text default ''
)
returns jsonb
language plpgsql
volatile security definer set search_path = ''
as $$
declare
  v_order public.nid_repair_orders;
  v_pro public.nid_professional_profiles;
  v_event_id uuid;
  v_approved boolean := false;
  v_workspace uuid;
begin
  select * into v_order from public.nid_repair_orders o where o.id = p_order_id for update;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;

  select a.workspace_id into v_workspace from public.nid_assets a where a.id = v_order.asset_id;

  if not exists (
    select 1 from public.nid_assets a
     where a.id = v_order.asset_id and a.current_owner_id = p_user_id
  ) and not exists (
    select 1 from public.nid_workspace_members m
     where m.workspace_id = v_workspace
       and m.user_id = p_user_id
       and m.status = 'actif'
       and m.role in ('owner', 'admin', 'manager')
  ) then
    return jsonb_build_object('state', 'non_autorise');
  end if;

  if v_order.status <> 'en_attente_validation' then
    return jsonb_build_object('state', 'etat_invalide', 'status', v_order.status);
  end if;

  if p_decision = 'refuse' then
    update public.nid_repair_orders
       set status = 'en_cours', refused_at = now(),
           refusal_reason = left(coalesce(p_reason, ''), 500)
     where id = p_order_id;

    insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id)
    values (p_user_id, 'utilisateur', 'repair.refused', 'repair_order', p_order_id, v_order.asset_id);

    return jsonb_build_object('state', 'refuse');
  end if;

  if v_order.professional_id is not null then
    select * into v_pro
      from public.nid_professional_profiles p
     where p.id = v_order.professional_id and p.status = 'approuve';
    v_approved := found;
  end if;

  insert into public.nid_events (
    asset_id, type, effective_date, title, description,
    author_user_id, author_role, author_label, professional_id,
    trust_level, source_type, workspace_id, cost_cents, metadata
  ) values (
    v_order.asset_id, 'reparation',
    coalesce(v_order.intervened_on, current_date),
    case when v_approved then 'Réparation attestée par un réparateur'
         else 'Intervention déclarée par l''atelier' end,
    coalesce(nullif(v_order.operation, ''), v_order.diagnosis),
    p_user_id,
    case when v_approved then 'professionnel' else 'proprietaire' end,
    coalesce(nullif(v_order.repairer_label, ''), 'Atelier'),
    v_order.professional_id,
    case when v_approved then 2 else 0 end,
    case when v_approved then 'atteste_reparateur' else 'declare_proprietaire' end,
    v_workspace,
    v_order.amount_cents,
    jsonb_build_object(
      'parts', v_order.parts,
      'parts_type', v_order.parts_type,
      'warranty_months', v_order.warranty_months,
      'diagnosis', v_order.diagnosis,
      'reported_problem', v_order.reported_problem
    )
  )
  returning id into v_event_id;

  update public.nid_repair_orders
     set status = 'termine', validated_at = now(), validated_by = p_user_id, event_id = v_event_id
   where id = p_order_id;

  update public.nid_assets
     set health_state = 'bon_etat',
         fleet_status = case when fleet_status = 'en_reparation' then 'en_stock' else fleet_status end,
         warranty_end = case
           when v_order.warranty_months is not null and v_order.warranty_months > 0
             then greatest(coalesce(warranty_end, current_date),
                           coalesce(v_order.intervened_on, current_date)
                             + (v_order.warranty_months * 30))
           else warranty_end end
   where id = v_order.asset_id;

  insert into public.nid_audit_logs (actor_user_id, actor_role, action, target_type, target_id, asset_id, metadata)
  values (p_user_id, 'utilisateur', 'repair.validated', 'repair_order', p_order_id, v_order.asset_id,
          jsonb_build_object('attested', v_approved));

  return jsonb_build_object('state', 'valide', 'event_id', v_event_id, 'attested', v_approved);
end;
$$;

revoke all on function public.nid_validate_repair_order(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------- Rapport partagé : projection publique sûre ----------
-- Complète `nid_resolve_share` sans la modifier : renvoie la provenance et
-- ne laisse JAMAIS sortir un identifiant complet, un nom de salarié, un
-- commentaire interne ou un coût d'entreprise.
create or replace function public.nid_share_report(p_token_hash text)
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
    return jsonb_build_object('state', 'revoque', 'created_at', v_share.created_at,
                              'expires_at', v_share.expires_at);
  end if;
  if v_share.expires_at <= now() then
    return jsonb_build_object('state', 'expire', 'created_at', v_share.created_at,
                              'expires_at', v_share.expires_at);
  end if;

  select * into v_asset from public.nid_assets a where a.id = v_share.asset_id;
  if not found then
    return jsonb_build_object('state', 'introuvable');
  end if;

  update public.nid_share_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_share.id;

  return jsonb_build_object(
    'state', 'valide',
    'created_at', v_share.created_at,
    'expires_at', v_share.expires_at,
    'label', v_share.label,
    'sections', to_jsonb(v_share.sections),
    'asset', jsonb_build_object(
      'public_id', v_asset.public_id,
      'brand', v_asset.brand,
      'model', v_asset.model,
      'color', v_asset.color,
      'storage_capacity', v_asset.storage_capacity,
      'purchase_year', case when v_asset.purchase_date is null then null
                            else extract(year from v_asset.purchase_date)::int end,
      'purchase_condition', v_asset.purchase_condition,
      'health_state', v_asset.health_state,
      'serial_last4', case when v_share.show_serial_last4 then nullif(v_asset.serial_last4, '') else null end
    ),
    'checkups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'answered_at', c.answered_at, 'answer', c.answer, 'source_type', c.source_type
      ) order by c.answered_at desc), '[]'::jsonb)
      from public.nid_checkups c where c.asset_id = v_asset.id
    ),
    'events', case when 'historique' = any (v_share.sections) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'type', e.type, 'effective_date', e.effective_date,
        'title', e.title, 'description', e.description,
        'source_type', e.source_type, 'trust_level', e.trust_level,
        'revoked_at', e.revoked_at
      ) order by e.effective_date desc, e.created_at desc), '[]'::jsonb)
      from public.nid_events e where e.asset_id = v_asset.id
    ) else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.nid_share_report(text) from public, anon, authenticated;

-- =============================================================
-- 9. Rattrapage des données existantes (non destructif)
-- =============================================================
-- Chaque propriétaire déjà présent reçoit son espace personnel et ses
-- téléphones y sont rattachés. Aucune ligne n'est supprimée ni réécrite
-- au-delà de la colonne `workspace_id` (auparavant NULL).

do $$
declare
  v_owner uuid;
begin
  for v_owner in
    select distinct a.current_owner_id
      from public.nid_assets a
     where a.current_owner_id is not null and a.workspace_id is null
  loop
    perform public.nid_ensure_personal_workspace(v_owner, 'Mon espace');
  end loop;
end
$$;

-- Planification par défaut pour les téléphones déjà enregistrés.
insert into public.nid_check_schedules (asset_id, workspace_id, frequency_months, next_due_on)
select a.id, a.workspace_id, 1, current_date + 30
  from public.nid_assets a
 where a.status <> 'archived'
on conflict (asset_id) do nothing;

commit;
