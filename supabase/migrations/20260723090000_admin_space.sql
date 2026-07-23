-- =============================================================
-- Nireo — espace d'administration séparé.
-- Tables : admin_users, admin_audit_logs, user_moderation,
-- admin_user_notes, site_settings, promo_codes,
-- promo_code_redemptions + extensions de contact_messages.
--
-- Sécurité : RLS activée SANS aucune policy sur toutes les tables
-- administratives → invisibles et inaccessibles aux clients (anon,
-- authenticated). Seule la clé secrète serveur (service role) lit
-- et écrit. Aucun utilisateur normal ne peut lire admin_users.
--
-- Idempotent. Aucune donnée existante supprimée ni modifiée.
-- =============================================================

begin;

-- ---------- 1. admin_users ----------
-- Un administrateur = un utilisateur Supabase Auth référencé ici.
-- Aucune inscription publique : les lignes sont créées uniquement
-- à la main (SQL Editor) ou par un script serveur.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.admin_users enable row level security;
-- Aucune policy : seule la clé secrète accède à cette table.
revoke all on table public.admin_users from anon, authenticated;

-- ---------- 2. admin_audit_logs ----------
-- Journal de TOUTES les actions administratives sensibles.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users (id) on delete set null,
  -- Dénormalisé : l'e-mail reste lisible même si l'admin est supprimé.
  admin_email text not null default '',
  action text not null,
  target_user_id uuid,
  target_label text not null default '',
  old_value jsonb,
  new_value jsonb,
  ip text,
  result text not null default 'success' check (result in ('success', 'error')),
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs (target_user_id);
create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;

-- ---------- 3. user_moderation ----------
-- Statut de modération d'un compte client (suspension / bannissement).
-- Le blocage effectif est appliqué via Supabase Auth (ban) côté serveur ;
-- cette table porte le statut lisible et la raison.

create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  reason text not null default '',
  updated_by uuid references public.admin_users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.user_moderation enable row level security;
revoke all on table public.user_moderation from anon, authenticated;

-- ---------- 4. admin_user_notes ----------
-- Notes internes sur un compte client (jamais visibles par le client).

create table if not exists public.admin_user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 2000),
  created_by uuid references public.admin_users (id) on delete set null,
  created_by_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_user_notes_user_idx
  on public.admin_user_notes (user_id, created_at desc);

alter table public.admin_user_notes enable row level security;
revoke all on table public.admin_user_notes from anon, authenticated;

-- ---------- 5. site_settings ----------
-- Configuration éditable depuis l'admin (jamais de secrets ici :
-- les clés Stripe/Supabase restent dans les variables d'environnement).

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.admin_users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;

insert into public.site_settings (key, value) values
  ('announcement_message', '""'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('support_email', '""'::jsonb),
  ('founder_enabled', 'true'::jsonb),
  ('founder_max_places', '100'::jsonb)
on conflict (key) do nothing;

-- Lecture PUBLIQUE limitée aux clés d'affichage (bandeau, maintenance,
-- e-mail support). Les autres clés restent serveur uniquement.
create or replace function public.public_site_settings()
returns jsonb
language sql
stable security definer set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
  from public.site_settings s
  where s.key in ('announcement_message', 'maintenance_mode', 'support_email');
$$;

grant execute on function public.public_site_settings() to anon, authenticated;

-- ---------- 6. promo_codes ----------
-- Registre des codes promo. Quand Stripe est connecté, le coupon et le
-- promotion code Stripe sont créés côté serveur et référencés ici :
-- Stripe reste la source de vérité pour l'application de la réduction.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 50),
  description text not null default '',
  discount_type text not null check (discount_type in ('percent', 'amount')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  currency text not null default 'eur',
  duration text not null default 'once' check (duration in ('once', 'repeating', 'forever')),
  duration_months integer check (duration_months is null or duration_months > 0),
  -- Plans concernés (vide = tous les plans payants).
  applies_to_plans text[] not null default '{}',
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  once_per_customer boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  times_redeemed integer not null default 0,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists promo_codes_updated_at on public.promo_codes;
create trigger promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

alter table public.promo_codes enable row level security;
revoke all on table public.promo_codes from anon, authenticated;

-- ---------- 7. promo_code_redemptions ----------
-- Utilisations enregistrées (webhook Stripe checkout.session.completed).

create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  user_email text not null default '',
  amount_total_cents integer,
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists promo_redemptions_code_idx
  on public.promo_code_redemptions (promo_code_id, created_at desc);

alter table public.promo_code_redemptions enable row level security;
revoke all on table public.promo_code_redemptions from anon, authenticated;

-- ---------- 8. contact_messages : colonnes support ----------
-- Additif uniquement : le statut historique ('received'/'emailed') et les
-- lignes existantes ne sont pas modifiés.

alter table public.contact_messages
  add column if not exists admin_status text not null default 'ouvert',
  add column if not exists priority text not null default 'normale',
  add column if not exists internal_note text not null default '',
  add column if not exists replied_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.contact_messages drop constraint if exists contact_messages_admin_status_check;
alter table public.contact_messages
  add constraint contact_messages_admin_status_check
  check (admin_status in ('ouvert', 'en_cours', 'resolu', 'ferme'));

alter table public.contact_messages drop constraint if exists contact_messages_priority_check;
alter table public.contact_messages
  add constraint contact_messages_priority_check
  check (priority in ('basse', 'normale', 'haute'));

commit;
