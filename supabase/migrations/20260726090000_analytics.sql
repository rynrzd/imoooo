-- =============================================================
-- Nireo — Analytics first-party (RGPD-friendly, sans service tiers).
--
-- Table analytics_events : événements réels (pages vues + événements métier).
-- Aucune donnée sensible : jamais de mot de passe, de carte, ni de contenu
-- de document. Visiteurs identifiés par un HASH non réversible (visitor_hash
-- = SHA-256 salé quotidien de IP+UA côté serveur) — aucune IP en clair,
-- cookieless. Pays / ville proviennent des en-têtes géo de l'hébergeur
-- (granularité légale). Écriture SERVEUR uniquement (clé secrète / triggers) :
-- RLS activée SANS policy + revoke all → invisible et inaccessible aux clients.
--
-- Idempotent. À exécuter dans le SQL Editor Supabase.
-- =============================================================

begin;

-- ---------- Table ----------

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'page_view', 'signup', 'property_added',
    'payment_started', 'subscription_success', 'payment_failed'
  )),
  -- page_view : chemin sans query string (jamais de données perso).
  path text,
  -- Identité cookieless non réversible (SHA-256 salé). NULL pour événements métier.
  visitor_hash text,
  -- Session éphémère (sessionStorage côté client) — présence temps réel.
  session_id text,
  source text check (source is null or source in
    ('tiktok', 'linkedin', 'facebook', 'google', 'direct', 'other')),
  device text check (device is null or device in ('mobile', 'desktop', 'tablet')),
  country text,
  city text,
  -- Événements métier : plan + montant (revenus). Jamais de PII.
  plan text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx
  on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_pv_visitor_idx
  on public.analytics_events (visitor_hash, created_at desc)
  where event_type = 'page_view';
create index if not exists analytics_events_pv_session_idx
  on public.analytics_events (session_id, created_at desc)
  where event_type = 'page_view';

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon, authenticated;
-- Aucune policy : seule la clé secrète (service role) et les triggers écrivent.

-- ---------- Triggers d'événements métier (incontournables) ----------

-- Inscription : une ligne par compte réellement créé (profil inséré une fois).
create or replace function public.analytics_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.analytics_events (event_type, user_id)
  values ('signup', new.id);
  return new;
end;
$$;

drop trigger if exists profiles_analytics_signup on public.profiles;
create trigger profiles_analytics_signup
  after insert on public.profiles
  for each row execute function public.analytics_on_signup();

-- Ajout d'un logement : capté au niveau base (les logements sont écrits
-- directement par le client — un trigger est le seul point fiable).
create or replace function public.analytics_on_property()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.analytics_events (event_type, user_id)
  values ('property_added', new.owner_id);
  return new;
end;
$$;

drop trigger if exists properties_analytics_added on public.properties;
create trigger properties_analytics_added
  after insert on public.properties
  for each row execute function public.analytics_on_property();

-- ---------- Fonctions d'agrégation (service role uniquement) ----------
-- Toutes SECURITY DEFINER + révoquées de public/anon/authenticated : seul le
-- client admin (clé secrète) les appelle, jamais un utilisateur.

-- KPIs scalaires. Fenêtres today/week/month en heure de Paris.
create or replace function public.analytics_kpis()
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (
    select
      (date_trunc('day',   now() at time zone 'Europe/Paris') at time zone 'Europe/Paris') as d0,
      (date_trunc('week',  now() at time zone 'Europe/Paris') at time zone 'Europe/Paris') as w0,
      (date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris') as m0
  )
  select jsonb_build_object(
    'onlineNow',   (select count(distinct coalesce(session_id, visitor_hash)) from public.analytics_events
                      where event_type = 'page_view' and created_at > now() - interval '5 minutes'),
    'uniqueToday', (select count(distinct visitor_hash) from public.analytics_events, b
                      where event_type = 'page_view' and created_at >= b.d0),
    'uniqueWeek',  (select count(distinct visitor_hash) from public.analytics_events, b
                      where event_type = 'page_view' and created_at >= b.w0),
    'uniqueMonth', (select count(distinct visitor_hash) from public.analytics_events, b
                      where event_type = 'page_view' and created_at >= b.m0),
    'totalViews',  (select count(*) from public.analytics_events where event_type = 'page_view'),
    'viewsToday',  (select count(*) from public.analytics_events, b
                      where event_type = 'page_view' and created_at >= b.d0),
    'signupsToday',(select count(*) from public.analytics_events, b where event_type = 'signup' and created_at >= b.d0),
    'signupsWeek', (select count(*) from public.analytics_events, b where event_type = 'signup' and created_at >= b.w0),
    'signupsMonth',(select count(*) from public.analytics_events, b where event_type = 'signup' and created_at >= b.m0),
    'subsToday',   (select count(*) from public.analytics_events, b where event_type = 'subscription_success' and created_at >= b.d0),
    'subsWeek',    (select count(*) from public.analytics_events, b where event_type = 'subscription_success' and created_at >= b.w0),
    'subsMonth',   (select count(*) from public.analytics_events, b where event_type = 'subscription_success' and created_at >= b.m0),
    'revenueTodayCents', (select coalesce(sum(amount_cents),0) from public.analytics_events, b where event_type = 'subscription_success' and created_at >= b.d0),
    'revenueWeekCents',  (select coalesce(sum(amount_cents),0) from public.analytics_events, b where event_type = 'subscription_success' and created_at >= b.w0),
    'revenueMonthCents', (select coalesce(sum(amount_cents),0) from public.analytics_events, b where event_type = 'subscription_success' and created_at >= b.m0)
  );
$$;

-- Répartitions sur une fenêtre (sources, appareils, pages, pays, villes).
create or replace function public.analytics_breakdowns(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with pv as (
    select * from public.analytics_events where event_type = 'page_view' and created_at >= p_since
  )
  select jsonb_build_object(
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', c) order by c desc), '[]'::jsonb)
                  from (select coalesce(source, 'other') as key, count(*) as c from pv group by 1) s),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', c) order by c desc), '[]'::jsonb)
                  from (select coalesce(device, 'desktop') as key, count(*) as c from pv group by 1) d),
    'topPages', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', c) order by c desc), '[]'::jsonb)
                  from (select path as key, count(*) as c from pv where path is not null group by 1 order by c desc limit 12) p),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', c) order by c desc), '[]'::jsonb)
                  from (select country as key, count(distinct visitor_hash) as c from pv where country is not null and country <> '' group by 1 order by c desc limit 12) co),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', c) order by c desc), '[]'::jsonb)
                  from (select city as key, count(distinct visitor_hash) as c from pv where city is not null and city <> '' group by 1 order by c desc limit 12) ci)
  );
$$;

-- Pages actuellement consultées (dernière page par session active < 5 min).
create or replace function public.analytics_active_pages()
returns jsonb language sql stable security definer set search_path = '' as $$
  with active as (
    select distinct on (coalesce(session_id, visitor_hash))
      coalesce(session_id, visitor_hash) as sid, path
    from public.analytics_events
    where event_type = 'page_view' and path is not null
      and created_at > now() - interval '5 minutes'
    order by coalesce(session_id, visitor_hash), created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', path, 'count', c) order by c desc), '[]'::jsonb)
  from (select path, count(*) as c from active group by path) x;
$$;

-- Série temporelle : buckets 'hour' | 'day' | 'month' depuis p_since.
create or replace function public.analytics_series(p_bucket text, p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with step as (
    select case p_bucket when 'hour' then interval '1 hour'
                         when 'month' then interval '1 month'
                         else interval '1 day' end as iv
  ),
  buckets as (
    select generate_series(date_trunc(p_bucket, p_since), date_trunc(p_bucket, now()), (select iv from step)) as b
  ),
  agg as (
    select date_trunc(p_bucket, created_at) as b, count(*) as views, count(distinct visitor_hash) as visitors
    from public.analytics_events
    where event_type = 'page_view' and created_at >= p_since
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', to_char(buckets.b at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'views', coalesce(agg.views, 0),
    'visitors', coalesce(agg.visitors, 0)
  ) order by buckets.b), '[]'::jsonb)
  from buckets left join agg on agg.b = buckets.b;
$$;

-- Activité en direct : derniers événements (jamais de PII / user_id exposé).
create or replace function public.analytics_live(p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', event_type, 'path', path, 'plan', plan, 'amountCents', amount_cents,
    'source', source, 'device', device, 'country', country, 'at', created_at
  ) order by created_at desc), '[]'::jsonb)
  from (
    select event_type, path, plan, amount_cents, source, device, country, created_at
    from public.analytics_events order by created_at desc limit greatest(1, least(p_limit, 50))
  ) e;
$$;

revoke all on function public.analytics_kpis() from public, anon, authenticated;
revoke all on function public.analytics_breakdowns(timestamptz) from public, anon, authenticated;
revoke all on function public.analytics_active_pages() from public, anon, authenticated;
revoke all on function public.analytics_series(text, timestamptz) from public, anon, authenticated;
revoke all on function public.analytics_live(integer) from public, anon, authenticated;
revoke all on function public.analytics_on_signup() from public, anon, authenticated;
revoke all on function public.analytics_on_property() from public, anon, authenticated;

commit;
