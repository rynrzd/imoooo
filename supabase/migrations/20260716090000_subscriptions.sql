-- =============================================================
-- ImmoPilot — abonnements Stripe
-- Table subscriptions, alignement des plans (free/starter/pro/business),
-- limite de logements appliquée côté base.
-- Idempotent : rejouable sans risque (SQL Editor ou supabase db push).
-- =============================================================

begin;

-- ---------- profiles.plan : nouveaux identifiants de plans ----------

-- Anciens plans → nouveaux (essentiel→starter, investisseur→pro).
update public.profiles set plan = 'starter' where plan = 'essentiel';
update public.profiles set plan = 'pro' where plan = 'investisseur';

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'business'));

-- ---------- subscriptions ----------
-- Écrite UNIQUEMENT par le serveur (webhook Stripe, via la clé secrète,
-- qui contourne la RLS). Les utilisateurs ne peuvent que lire leur ligne.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'business')),
  status text not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Lecture seule, chacun sa ligne. Aucune policy INSERT/UPDATE/DELETE :
-- seules les écritures serveur (clé secrète) sont possibles.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using ((select auth.uid()) = user_id);

-- ---------- Limite de logements selon le plan ----------
-- Garde serveur « dure » : même un client contourné ne peut pas dépasser
-- son quota. ⚠️ Les limites doivent rester alignées avec
-- src/lib/stripe/plans.ts (free=1, starter=10, pro/business=illimité).

create or replace function public.enforce_property_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  owner_plan text;
  max_properties integer;
  current_count integer;
begin
  select plan into owner_plan from public.profiles where id = new.owner_id;

  max_properties := case coalesce(owner_plan, 'free')
    when 'free' then 1
    when 'starter' then 10
    else null -- pro, business : illimité
  end;

  if max_properties is not null then
    select count(*) into current_count
    from public.properties where owner_id = new.owner_id;
    if current_count >= max_properties then
      raise exception
        'Limite du plan atteinte : % logement(s) maximum. Passez à un plan supérieur.',
        max_properties
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists properties_enforce_limit on public.properties;
create trigger properties_enforce_limit
  before insert on public.properties
  for each row execute function public.enforce_property_limit();

commit;
