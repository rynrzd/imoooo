-- Profils : colonnes email + plan, création automatique idempotente.
-- À appliquer via le SQL Editor de Supabase (ou `supabase db push`).

-- ---------- colonnes ----------

alter table public.profiles
  add column if not exists email text not null default '';

alter table public.profiles
  add column if not exists plan text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_check
      check (plan in ('free', 'essentiel', 'investisseur', 'pro'));
  end if;
end $$;

-- ---------- création automatique du profil ----------

-- Un seul profil par utilisateur : l'insert est idempotent (on conflict),
-- un échec du trigger ne doit jamais bloquer la création du compte.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, plan)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Le trigger existe déjà (migration initiale) ; on le recrée à l'identique
-- au cas où cette migration serait appliquée sur une base vierge.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- rattrapage des comptes existants ----------

-- Profils manquants (comptes créés avant le trigger).
insert into public.profiles (id, email, full_name, plan)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'free'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- E-mails absents sur les profils existants.
update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');
