-- =============================================================
-- ImmoPilot — plans V1 : free / essentiel / pro / business.
-- Renomme « starter » en « essentiel » et aligne les limites de
-- logements (free=1, essentiel=5, pro=25, business=sur mesure).
-- Idempotent : fonctionne que 20260716090000_subscriptions.sql ait
-- été appliquée ou non.
-- =============================================================

begin;

-- ---------- profiles.plan ----------

update public.profiles set plan = 'essentiel' where plan in ('starter');
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'essentiel', 'pro', 'business'));

-- ---------- subscriptions.plan (si la table existe) ----------

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'subscriptions'
  ) then
    update public.subscriptions set plan = 'essentiel' where plan in ('starter');
    alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
    alter table public.subscriptions
      add constraint subscriptions_plan_check
      check (plan in ('free', 'essentiel', 'pro', 'business'));
  end if;
end $$;

-- ---------- Limite de logements par plan ----------
-- ⚠️ Doit rester alignée avec src/lib/stripe/plans.ts.

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
    when 'essentiel' then 5
    when 'pro' then 25
    else null -- business : sur mesure (pas de limite technique)
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
