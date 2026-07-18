-- =============================================================
-- ImmoPilot — plans V2 (free/starter/pro/business+), abonnement Free
-- automatique, quotas serveur (logements, locataires, documents,
-- photos), offre Fondateur (100 places, numérotation atomique).
-- Idempotent. ⚠️ Limites alignées sur src/config/plans.ts.
-- =============================================================

begin;

-- ---------- 1. Renommage essentiel → starter ----------

update public.profiles set plan = 'starter' where plan = 'essentiel';
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'business'));

-- ---------- 2. Table subscriptions étendue ----------

alter table public.subscriptions alter column stripe_customer_id drop not null;
alter table public.subscriptions
  add column if not exists provider text not null default 'manual',
  add column if not exists lifetime_access boolean not null default false,
  add column if not exists founder_tier smallint,
  add column if not exists founder_purchase_number integer;

update public.subscriptions set plan = 'starter' where plan = 'essentiel';
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'starter', 'pro', 'business'));

update public.subscriptions set status = 'inactive'
  where status not in ('active', 'trialing', 'inactive', 'past_due', 'canceled');
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active', 'trialing', 'inactive', 'past_due', 'canceled'));

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('manual', 'stripe', 'founder'));

alter table public.subscriptions drop constraint if exists subscriptions_founder_tier_check;
alter table public.subscriptions
  add constraint subscriptions_founder_tier_check
  check (founder_tier is null or founder_tier in (1, 2));

create unique index if not exists subscriptions_founder_number_idx
  on public.subscriptions (founder_purchase_number)
  where founder_purchase_number is not null;

-- Écriture serveur uniquement (déjà en place — rappel ceinture/bretelles).
revoke insert, update, delete on table public.subscriptions from anon, authenticated;

-- ---------- 3. Abonnement Free automatique ----------
-- À l'inscription : ligne Free active. Jamais bloquant : l'application
-- retombe sur Free si la ligne manque malgré tout.

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan, status, provider)
  values (new.id, 'free', 'active', 'manual')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Réparation des comptes existants sans abonnement (plan pris du profil).
insert into public.subscriptions (user_id, plan, status, provider)
select u.id, coalesce(p.plan, 'free'), 'active', 'manual'
from auth.users u
left join public.profiles p on p.id = u.id
where not exists (select 1 from public.subscriptions s where s.user_id = u.id);

-- ---------- 4. Quotas serveur ----------
-- ⚠️ Alignés sur src/config/plans.ts. Le plan est lu dans profiles.plan
-- (colonne modifiable UNIQUEMENT par le serveur : privilèges par colonne).

create or replace function public.plan_of_owner(p_owner uuid)
returns text
language sql
stable security definer set search_path = ''
as $$ select coalesce((select plan from public.profiles where id = p_owner), 'free') $$;

create or replace function public.enforce_property_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  max_properties integer;
  current_count integer;
begin
  max_properties := case public.plan_of_owner(new.owner_id)
    when 'free' then 1
    when 'starter' then 10
    when 'pro' then 30
    else null -- business+ : illimité
  end;
  if max_properties is not null then
    select count(*) into current_count
    from public.properties where owner_id = new.owner_id;
    if current_count >= max_properties then
      raise exception
        'Votre plan permet % logement(s) maximum. Passez à un plan supérieur pour en ajouter.',
        max_properties using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_enforce_limit on public.properties;
create trigger properties_enforce_limit
  before insert on public.properties
  for each row execute function public.enforce_property_limit();

-- Locataires actifs = baux sans date de sortie.
create or replace function public.enforce_active_tenant_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  max_tenants integer;
  current_count integer;
begin
  if new.exit_date is not null then return new; end if;
  max_tenants := case public.plan_of_owner(new.owner_id)
    when 'free' then 1
    else null -- starter/pro/business : suit le nombre de logements
  end;
  if max_tenants is not null then
    select count(*) into current_count
    from public.leases where owner_id = new.owner_id and exit_date is null
      and id is distinct from new.id;
    if current_count >= max_tenants then
      raise exception
        'Votre plan permet % locataire(s) actif(s) maximum. Passez à un plan supérieur.',
        max_tenants using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leases_enforce_tenant_limit on public.leases;
create trigger leases_enforce_tenant_limit
  before insert or update of exit_date on public.leases
  for each row execute function public.enforce_active_tenant_limit();

create or replace function public.enforce_document_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  max_documents integer;
  current_count integer;
begin
  max_documents := case public.plan_of_owner(new.owner_id)
    when 'free' then 20
    when 'starter' then 500
    when 'pro' then 2000
    else null
  end;
  if max_documents is not null then
    select count(*) into current_count
    from public.documents where owner_id = new.owner_id;
    if current_count >= max_documents then
      raise exception
        'Votre plan permet % documents maximum. Passez à un plan supérieur.',
        max_documents using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_enforce_limit on public.documents;
create trigger documents_enforce_limit
  before insert on public.documents
  for each row execute function public.enforce_document_limit();

create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  max_photos integer;
  current_count integer;
begin
  max_photos := case public.plan_of_owner(new.owner_id)
    when 'free' then 20
    when 'starter' then 500
    when 'pro' then 2000
    else null
  end;
  if max_photos is not null then
    select count(*) into current_count
    from public.property_photos where owner_id = new.owner_id;
    if current_count >= max_photos then
      raise exception
        'Votre plan permet % photos maximum. Passez à un plan supérieur.',
        max_photos using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists property_photos_enforce_limit on public.property_photos;
create trigger property_photos_enforce_limit
  before insert on public.property_photos
  for each row execute function public.enforce_photo_limit();

-- ---------- 5. Offre Fondateur ----------

create table if not exists public.founder_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Attribué UNIQUEMENT à la confirmation du paiement (fonction atomique).
  purchase_number integer unique,
  tier smallint check (tier in (1, 2)),
  amount_cents integer,
  currency text not null default 'eur',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'canceled')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.founder_purchases enable row level security;
drop policy if exists "founder_purchases_select_own" on public.founder_purchases;
create policy "founder_purchases_select_own" on public.founder_purchases
  for select using ((select auth.uid()) = user_id);
revoke insert, update, delete on table public.founder_purchases from anon, authenticated;

-- Liste d'attente (Stripe non configuré) : aucune place réservée.
create table if not exists public.founder_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) between 3 and 200),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.founder_waitlist enable row level security;
-- Aucune policy : écriture/lecture serveur uniquement (clé secrète).

-- Confirmation ATOMIQUE d'une place (appelée par le webhook Stripe via la
-- clé secrète — jamais par un client). Idempotente : même session → même
-- numéro. Deux paiements simultanés ne peuvent pas obtenir le même numéro
-- (verrou transactionnel global).
create or replace function public.confirm_founder_purchase(
  p_user_id uuid,
  p_session_id text,
  p_payment_intent text,
  p_amount_cents integer,
  p_currency text
)
returns table (purchase_number integer, tier smallint)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_existing public.founder_purchases%rowtype;
  v_number integer;
  v_tier smallint;
begin
  perform pg_advisory_xact_lock(hashtext('immopilot_founder_purchases'));

  -- Idempotence : session déjà confirmée → renvoyer la même place.
  select * into v_existing from public.founder_purchases
    where stripe_checkout_session_id = p_session_id;
  if found and v_existing.status = 'confirmed' then
    return query select v_existing.purchase_number, v_existing.tier;
    return;
  end if;

  -- Une seule place par compte.
  select * into v_existing from public.founder_purchases
    where user_id = p_user_id and status = 'confirmed';
  if found then
    return query select v_existing.purchase_number, v_existing.tier;
    return;
  end if;

  select coalesce(max(fp.purchase_number), 0) + 1 into v_number
    from public.founder_purchases fp where fp.status = 'confirmed';
  if v_number > 100 then
    raise exception 'founder_sold_out' using errcode = 'P0001';
  end if;
  v_tier := case when v_number <= 50 then 1 else 2 end;

  insert into public.founder_purchases as fp
    (user_id, purchase_number, tier, amount_cents, currency, status,
     stripe_checkout_session_id, stripe_payment_intent_id, confirmed_at)
  values
    (p_user_id, v_number, v_tier, p_amount_cents, lower(p_currency), 'confirmed',
     p_session_id, p_payment_intent, now())
  on conflict (user_id) do update set
    purchase_number = excluded.purchase_number,
    tier = excluded.tier,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    status = 'confirmed',
    stripe_checkout_session_id = excluded.stripe_checkout_session_id,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    confirmed_at = now();

  -- Accès Business+ à vie.
  insert into public.subscriptions as s
    (user_id, plan, status, provider, lifetime_access, founder_tier, founder_purchase_number)
  values (p_user_id, 'business', 'active', 'founder', true, v_tier, v_number)
  on conflict (user_id) do update set
    plan = 'business', status = 'active', provider = 'founder',
    lifetime_access = true, founder_tier = excluded.founder_tier,
    founder_purchase_number = excluded.founder_purchase_number;

  update public.profiles set plan = 'business' where id = p_user_id;

  return query select v_number, v_tier;
end;
$$;

revoke execute on function public.confirm_founder_purchase(uuid, text, text, integer, text)
  from public, anon, authenticated;

-- État public de l'offre (nombre fiable de places confirmées).
create or replace function public.founder_offer_status()
returns json
language sql
stable security definer set search_path = ''
as $$
  select json_build_object(
    'confirmed', (select count(*) from public.founder_purchases where status = 'confirmed'),
    'total', 100
  );
$$;

grant execute on function public.founder_offer_status() to anon, authenticated;

-- ---------- 6. Onboarding : première inscription uniquement ----------

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Les comptes EXISTANTS ne sont jamais forcés dans l'onboarding :
-- seuls les comptes créés après cette migration le voient (une fois).
update public.profiles
  set onboarding_completed = true, onboarding_completed_at = now()
  where onboarding_completed = false;

grant update (full_name, phone, avatar_url, company_name,
  onboarding_completed, onboarding_completed_at, product_tour_completed)
  on table public.profiles to authenticated;

commit;
