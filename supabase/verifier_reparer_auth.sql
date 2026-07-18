-- =============================================================
-- ImmoPilot — VÉRIFICATION + RÉPARATION de l'authentification.
-- À exécuter dans Supabase Dashboard → SQL Editor (projet vetzweeeywgxytuqspqb).
-- Idempotent : rejouable sans risque. Ne touche à AUCUNE donnée utilisateur
-- (uniquement colonnes manquantes, privilèges, triggers et backfills).
-- =============================================================

begin;

-- ---------- 1. Colonnes onboarding (si migrations partielles) ----------

alter table public.profiles
  add column if not exists company_name text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists product_tour_completed boolean not null default false;

-- ---------- 2. Privilèges par colonne (CAUSE de la visite qui revient) ----------
-- protect_plan_column a révoqué UPDATE puis n'a ré-autorisé que 3 colonnes.
-- Sans ce grant complet, l'enregistrement de l'onboarding échoue en silence
-- et l'assistant réapparaît à CHAQUE connexion.

revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, company_name,
  onboarding_completed, onboarding_completed_at, product_tour_completed)
  on table public.profiles to authenticated;

-- ---------- 3. Profil automatique à l'inscription (idempotent) ----------

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 4. Abonnement Free automatique (si table présente) ----------

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'subscriptions') then
    -- Réparation des comptes sans profil puis sans abonnement (aucun doublon).
    insert into public.profiles (id, email, full_name, plan)
    select u.id, coalesce(u.email, ''),
           coalesce(u.raw_user_meta_data ->> 'full_name', ''), 'free'
    from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id)
    on conflict (id) do nothing;

    insert into public.subscriptions (user_id, plan, status, provider)
    select u.id, coalesce(p.plan, 'free'), 'active', 'manual'
    from auth.users u
    left join public.profiles p on p.id = u.id
    where not exists (select 1 from public.subscriptions s where s.user_id = u.id);
  end if;
end $$;

commit;

-- =============================================================
-- VÉRIFICATIONS (lecture seule — exécuter après le bloc ci-dessus)
-- =============================================================

-- A. Les colonnes modifiables par un utilisateur connecté (7 lignes attendues,
--    JAMAIS « plan ») :
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;

-- B. Comptes sans profil ou sans abonnement (0 ligne attendue partout) :
select 'sans_profil' as probleme, count(*) from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
union all
select 'sans_abonnement', count(*) from auth.users u
  where not exists (select 1 from public.subscriptions s where s.user_id = u.id);

-- C. Doublons (0 ligne attendue) :
select email, count(*) from auth.users group by email having count(*) > 1;

-- D. Comptes de test à examiner AVANT toute suppression MANUELLE
--    (jamais de suppression automatique) :
select id, email, created_at, email_confirmed_at, last_sign_in_at
from auth.users
where email ilike '%+ipilot-test%' or email ilike '%test%' or email ilike '%example.com%'
order by created_at desc;
