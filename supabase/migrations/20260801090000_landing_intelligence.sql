-- =============================================================
-- Nireo — LANDING INTELLIGENCE
-- Moteur de personnalisation + expérimentation + optimisation de la vitrine.
--
-- Trois objets seulement, tous en écriture SERVEUR (clé secrète) :
--   1. landing_events          : le comportement réel des visiteurs (anonyme).
--   2. landing_config          : la configuration ACTIVE de la landing.
--   3. landing_versions        : l'historique complet (retour arrière 1 clic).
--   4. landing_recommendations : les recommandations générées + leur statut.
--
-- RGPD : aucune donnée personnelle. `visitor_id` est un identifiant ALÉATOIRE
-- posé par le serveur (cookie first-party, non lié à l'identité, jamais dérivé
-- de l'IP), les coordonnées de clic sont RELATIVES (0..1), aucun contenu de
-- formulaire n'est collecté. Pays / langue viennent des en-têtes de l'hôte.
--
-- Toutes les fonctions d'agrégation sont SECURITY DEFINER et révoquées de
-- public/anon/authenticated : seul le client admin (clé secrète) les appelle.
--
-- Idempotent. À exécuter dans le SQL Editor Supabase.
-- =============================================================

begin;

-- =============================================================
-- 1. Événements comportementaux
-- =============================================================

create table if not exists public.landing_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    -- Cycle de vie de la page
    'exposure',        -- une session voit une combinaison de variantes (dénominateur)
    'engage',          -- session engagée (scroll >= 25 % ou >= 10 s)
    'scroll',          -- jalon de profondeur (value = 25/50/75/90/100)
    'section_view',    -- une section est entrée dans le viewport
    'section_dwell',   -- temps passé sur une section (value = secondes)
    'click',           -- clic sur un élément instrumenté (heatmap)
    'cta_click',       -- clic sur un appel à l'action
    'video_play',
    'video_progress',  -- value = pourcentage visionné
    'exit',            -- fin de visite (value = secondes passées)
    -- Tunnel de conversion (les 4 derniers sont écrits par le SERVEUR)
    'signup_started',
    'plan_selected',
    'signup_completed',
    'payment_started',
    'payment_success'
  )),
  -- Identité cookieless : UUID aléatoire posé par le serveur (aucune PII).
  visitor_id text not null,
  session_id text,
  path text not null default '/',
  -- Profil détecté au moment du rendu serveur.
  segment text,
  source text,
  device text,
  country text,
  language text,
  is_returning boolean,
  visit_count integer,
  -- Combinaison de variantes servie : { "hero_headline": "problem", ... }
  assignments jsonb not null default '{}'::jsonb,
  config_version integer,
  -- Précisions selon le type d'événement.
  slot text,
  variant text,
  section text,
  element text,
  value numeric,
  meta jsonb,
  -- Renseigné uniquement pour les conversions confirmées côté serveur.
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists landing_events_created_idx
  on public.landing_events (created_at desc);
create index if not exists landing_events_type_created_idx
  on public.landing_events (event_type, created_at desc);
create index if not exists landing_events_session_idx
  on public.landing_events (session_id, created_at desc);
create index if not exists landing_events_visitor_idx
  on public.landing_events (visitor_id, created_at desc);
create index if not exists landing_events_exposure_idx
  on public.landing_events (created_at desc)
  where event_type = 'exposure';
-- Une seule conversion « compte créé » par utilisateur (anti double comptage).
create unique index if not exists landing_events_signup_unique_idx
  on public.landing_events (user_id)
  where event_type = 'signup_completed' and user_id is not null;

alter table public.landing_events enable row level security;
revoke all on table public.landing_events from anon, authenticated;
-- Aucune policy : seule la clé secrète écrit et lit.

-- =============================================================
-- 2. Configuration active + historique des versions
-- =============================================================

create table if not exists public.landing_config (
  id boolean primary key default true check (id),
  version integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.admin_users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.landing_config enable row level security;
revoke all on table public.landing_config from anon, authenticated;

insert into public.landing_config (id, version, config)
values (true, 1, '{}'::jsonb)
on conflict (id) do nothing;

create table if not exists public.landing_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  config jsonb not null,
  label text not null default '',
  reason text not null default '',
  -- 'manual' | 'recommendation' | 'autopilot' | 'rollback' | 'compose'
  origin text not null default 'manual',
  recommendation_key text,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists landing_versions_created_idx
  on public.landing_versions (created_at desc);

alter table public.landing_versions enable row level security;
revoke all on table public.landing_versions from anon, authenticated;

-- =============================================================
-- 3. Recommandations
-- =============================================================

create table if not exists public.landing_recommendations (
  id uuid primary key default gen_random_uuid(),
  -- Clé stable : une même analyse ne crée jamais de doublon.
  key text not null unique,
  kind text not null,
  title text not null,
  detail text not null default '',
  -- Pourquoi : les chiffres RÉELS qui justifient la recommandation.
  evidence jsonb not null default '{}'::jsonb,
  -- Ce que « Appliquer » fera (patch de configuration validé).
  patch jsonb not null default '{}'::jsonb,
  impact numeric not null default 0,
  confidence numeric not null default 0,
  severity text not null default 'info' check (severity in ('info', 'opportunity', 'warning')),
  status text not null default 'open' check (status in ('open', 'applied', 'dismissed')),
  applied_version integer,
  applied_at timestamptz,
  applied_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_reco_status_idx
  on public.landing_recommendations (status, impact desc);

alter table public.landing_recommendations enable row level security;
revoke all on table public.landing_recommendations from anon, authenticated;

-- =============================================================
-- 4. Agrégations (SECURITY DEFINER, service role uniquement)
-- =============================================================

-- ---------- Vue « session » : la brique de tous les calculs ----------
-- Une session = une visite. On lui rattache sa combinaison de variantes
-- (celle de la 1re exposition) et ce qu'elle a réellement fait.
create or replace function public.landing_sessions(p_since timestamptz)
returns table (
  session_id text,
  visitor_id text,
  assignments jsonb,
  segment text,
  source text,
  device text,
  country text,
  language text,
  is_returning boolean,
  started_at timestamptz,
  engaged boolean,
  max_scroll numeric,
  dwell numeric,
  cta_clicks integer,
  video_played boolean,
  signup_started boolean,
  plan_selected boolean,
  signup_completed boolean,
  payment_started boolean,
  payment_success boolean
)
language sql stable security definer set search_path = '' as $$
  with expo as (
    select distinct on (e.session_id)
      e.session_id, e.visitor_id, e.assignments, e.segment, e.source, e.device,
      e.country, e.language, e.is_returning, e.created_at
    from public.landing_events e
    where e.event_type = 'exposure'
      and e.created_at >= p_since
      and e.session_id is not null
    order by e.session_id, e.created_at asc
  ),
  acts as (
    select
      a.session_id,
      bool_or(a.event_type = 'engage') as engaged,
      coalesce(max(a.value) filter (where a.event_type = 'scroll'), 0) as max_scroll,
      coalesce(max(a.value) filter (where a.event_type = 'exit'), 0) as dwell,
      (count(*) filter (where a.event_type = 'cta_click'))::integer as cta_clicks,
      bool_or(a.event_type = 'video_play') as video_played,
      bool_or(a.event_type = 'signup_started') as signup_started,
      bool_or(a.event_type = 'plan_selected') as plan_selected,
      bool_or(a.event_type = 'signup_completed') as signup_completed,
      bool_or(a.event_type = 'payment_started') as payment_started,
      bool_or(a.event_type = 'payment_success') as payment_success
    from public.landing_events a
    where a.created_at >= p_since and a.session_id is not null
    group by a.session_id
  )
  select
    expo.session_id, expo.visitor_id, expo.assignments, expo.segment, expo.source,
    expo.device, expo.country, expo.language, expo.is_returning, expo.created_at,
    coalesce(acts.engaged, false), coalesce(acts.max_scroll, 0), coalesce(acts.dwell, 0),
    coalesce(acts.cta_clicks, 0), coalesce(acts.video_played, false),
    coalesce(acts.signup_started, false), coalesce(acts.plan_selected, false),
    coalesce(acts.signup_completed, false), coalesce(acts.payment_started, false),
    coalesce(acts.payment_success, false)
  from expo left join acts on acts.session_id = expo.session_id;
$$;

-- ---------- KPIs globaux ----------
create or replace function public.landing_kpis(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since))
  select jsonb_build_object(
    'sessions',        (select count(*) from s),
    'visitors',        (select count(distinct visitor_id) from s),
    'engaged',         (select count(*) from s where engaged),
    'ctaClicks',       (select count(*) from s where cta_clicks > 0),
    'signupStarted',   (select count(*) from s where signup_started),
    'signups',         (select count(*) from s where signup_completed),
    'planSelected',    (select count(*) from s where plan_selected),
    'paymentStarted',  (select count(*) from s where payment_started),
    'payments',        (select count(*) from s where payment_success),
    'avgDwell',        (select coalesce(round(avg(dwell)::numeric, 1), 0) from s where dwell > 0),
    'medianScroll',    (select coalesce(percentile_cont(0.5) within group (order by max_scroll), 0) from s),
    'bounced',         (select count(*) from s where not engaged),
    'returning',       (select count(*) from s where is_returning),
    'liveSessions',    (select count(distinct session_id) from public.landing_events
                          where created_at > now() - interval '5 minutes' and session_id is not null)
  );
$$;

-- ---------- Tunnel de conversion complet ----------
create or replace function public.landing_funnel(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since))
  select jsonb_build_array(
    jsonb_build_object('key', 'visit',           'label', 'Visites',              'count', (select count(*) from s)),
    jsonb_build_object('key', 'engaged',         'label', 'Sessions engagées',    'count', (select count(*) from s where engaged)),
    jsonb_build_object('key', 'deep_scroll',     'label', 'Scroll > 50 %',        'count', (select count(*) from s where max_scroll >= 50)),
    jsonb_build_object('key', 'cta',             'label', 'Clic sur un CTA',      'count', (select count(*) from s where cta_clicks > 0)),
    jsonb_build_object('key', 'signup_started',  'label', 'Inscription démarrée', 'count', (select count(*) from s where signup_started)),
    jsonb_build_object('key', 'signup',          'label', 'Compte créé',          'count', (select count(*) from s where signup_completed)),
    jsonb_build_object('key', 'plan',            'label', 'Abonnement choisi',    'count', (select count(*) from s where plan_selected)),
    jsonb_build_object('key', 'payment_started', 'label', 'Paiement démarré',     'count', (select count(*) from s where payment_started)),
    jsonb_build_object('key', 'payment',         'label', 'Paiement confirmé',    'count', (select count(*) from s where payment_success))
  );
$$;

-- ---------- Performance par variante (le cœur de l'A/B testing) ----------
create or replace function public.landing_variant_stats(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since)),
  x as (
    select kv.key as slot, kv.value as variant, s.*
    from s, lateral jsonb_each_text(s.assignments) as kv(key, value)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'slot', slot, 'variant', variant,
    'sessions', sessions, 'engaged', engaged, 'ctaClicks', cta,
    'signups', signups, 'payments', payments,
    'avgDwell', avg_dwell, 'avgScroll', avg_scroll
  ) order by slot, variant), '[]'::jsonb)
  from (
    select
      slot, variant,
      count(*)::int as sessions,
      (count(*) filter (where engaged))::int as engaged,
      (count(*) filter (where cta_clicks > 0))::int as cta,
      (count(*) filter (where signup_completed))::int as signups,
      (count(*) filter (where payment_success))::int as payments,
      coalesce(round((avg(dwell) filter (where dwell > 0))::numeric, 1), 0) as avg_dwell,
      coalesce(round(avg(max_scroll)::numeric, 1), 0) as avg_scroll
    from x group by slot, variant
  ) g;
$$;

-- ---------- Performance par segment d'audience ----------
create or replace function public.landing_segment_stats(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since))
  select coalesce(jsonb_agg(jsonb_build_object(
    'segment', segment, 'sessions', sessions, 'engaged', engaged, 'ctaClicks', cta,
    'signups', signups, 'payments', payments, 'avgDwell', avg_dwell, 'avgScroll', avg_scroll
  ) order by sessions desc), '[]'::jsonb)
  from (
    select
      coalesce(segment, 'direct') as segment,
      count(*)::int as sessions,
      (count(*) filter (where engaged))::int as engaged,
      (count(*) filter (where cta_clicks > 0))::int as cta,
      (count(*) filter (where signup_completed))::int as signups,
      (count(*) filter (where payment_success))::int as payments,
      coalesce(round((avg(dwell) filter (where dwell > 0))::numeric, 1), 0) as avg_dwell,
      coalesce(round(avg(max_scroll)::numeric, 1), 0) as avg_scroll
    from s group by 1
  ) g;
$$;

-- ---------- Croisement segment × variante (personnalisation) ----------
create or replace function public.landing_segment_variant_stats(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since)),
  x as (
    select kv.key as slot, kv.value as variant, s.*
    from s, lateral jsonb_each_text(s.assignments) as kv(key, value)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'segment', segment, 'slot', slot, 'variant', variant,
    'sessions', sessions, 'ctaClicks', cta, 'signups', signups, 'engaged', engaged
  ) order by sessions desc), '[]'::jsonb)
  from (
    select
      coalesce(segment, 'direct') as segment, slot, variant,
      count(*)::int as sessions,
      (count(*) filter (where cta_clicks > 0))::int as cta,
      (count(*) filter (where signup_completed))::int as signups,
      (count(*) filter (where engaged))::int as engaged
    from x group by 1, 2, 3
    having count(*) >= 5
  ) g;
$$;

-- ---------- Performance par appareil ----------
create or replace function public.landing_device_stats(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since))
  select coalesce(jsonb_agg(jsonb_build_object(
    'device', device, 'sessions', sessions, 'engaged', engaged, 'ctaClicks', cta,
    'signups', signups, 'avgDwell', avg_dwell, 'avgScroll', avg_scroll
  ) order by sessions desc), '[]'::jsonb)
  from (
    select
      coalesce(device, 'desktop') as device,
      count(*)::int as sessions,
      (count(*) filter (where engaged))::int as engaged,
      (count(*) filter (where cta_clicks > 0))::int as cta,
      (count(*) filter (where signup_completed))::int as signups,
      coalesce(round((avg(dwell) filter (where dwell > 0))::numeric, 1), 0) as avg_dwell,
      coalesce(round(avg(max_scroll)::numeric, 1), 0) as avg_scroll
    from s group by 1
  ) g;
$$;

-- ---------- Sections : vues, temps passé, abandons ----------
-- « exits » = sessions dont la section la plus profonde atteinte est celle-ci.
create or replace function public.landing_sections(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with views as (
    select section, count(distinct session_id)::int as sessions
    from public.landing_events
    where event_type = 'section_view' and created_at >= p_since and section is not null
    group by 1
  ),
  dwell as (
    select section, round(avg(value)::numeric, 1) as avg_dwell
    from public.landing_events
    where event_type = 'section_dwell' and created_at >= p_since and section is not null and value > 0
    group by 1
  ),
  last_seen as (
    select distinct on (session_id) session_id, section
    from public.landing_events
    where event_type = 'section_view' and created_at >= p_since and section is not null
    order by session_id, created_at desc
  ),
  exits as (select section, count(*)::int as exits from last_seen group by 1),
  converted as (
    select distinct on (l.session_id) l.session_id, l.section
    from public.landing_events l
    join public.landing_events c
      on c.session_id = l.session_id and c.event_type = 'cta_click'
    where l.event_type = 'section_view' and l.created_at >= p_since and l.section is not null
    order by l.session_id, l.created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'section', v.section,
    'sessions', v.sessions,
    'avgDwell', coalesce(d.avg_dwell, 0),
    'exits', coalesce(e.exits, 0),
    'exitsWithoutCta', greatest(coalesce(e.exits, 0) - coalesce(cv.n, 0), 0)
  ) order by v.sessions desc), '[]'::jsonb)
  from views v
  left join dwell d on d.section = v.section
  left join exits e on e.section = v.section
  left join (select section, count(*)::int as n from converted group by 1) cv on cv.section = v.section;
$$;

-- ---------- Carte de scroll (profondeur atteinte, par appareil) ----------
create or replace function public.landing_scrollmap(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (select * from public.landing_sessions(p_since)),
  total as (select count(*)::numeric as n from s),
  buckets as (select unnest(array[25, 50, 75, 90, 100]) as depth)
  select coalesce(jsonb_agg(jsonb_build_object(
    'depth', b.depth,
    'sessions', (select count(*) from s where s.max_scroll >= b.depth),
    'ratio', case when (select n from total) > 0
                  then round((select count(*) from s where s.max_scroll >= b.depth)::numeric
                             / (select n from total) * 100, 1)
                  else 0 end,
    'mobile', (select count(*) from s where s.max_scroll >= b.depth and s.device = 'mobile'),
    'desktop', (select count(*) from s where s.max_scroll >= b.depth and s.device <> 'mobile')
  ) order by b.depth), '[]'::jsonb)
  from buckets b;
$$;

-- ---------- Heatmap de clics (grille 24 × 40, coordonnées relatives) ----------
create or replace function public.landing_heatmap(p_since timestamptz, p_device text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('x', gx, 'y', gy, 'count', c) order by c desc), '[]'::jsonb)
  from (
    select
      least(23, greatest(0, floor((meta->>'x')::numeric * 24)))::int as gx,
      least(39, greatest(0, floor((meta->>'y')::numeric * 40)))::int as gy,
      count(*)::int as c
    from public.landing_events
    where event_type in ('click', 'cta_click')
      and created_at >= p_since
      and meta ? 'x' and meta ? 'y'
      and (p_device is null or device = p_device)
    group by 1, 2
    order by c desc
    limit 400
  ) g;
$$;

-- ---------- Éléments les plus cliqués ----------
create or replace function public.landing_elements(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'element', element, 'clicks', clicks, 'sessions', sessions
  ) order by clicks desc), '[]'::jsonb)
  from (
    select element, count(*)::int as clicks, count(distinct session_id)::int as sessions
    from public.landing_events
    where event_type in ('click', 'cta_click') and created_at >= p_since and element is not null
    group by 1 order by 2 desc limit 25
  ) g;
$$;

-- ---------- Évolution temporelle (jour / semaine) ----------
create or replace function public.landing_series(p_bucket text, p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with step as (
    select case p_bucket when 'hour' then interval '1 hour'
                         when 'week' then interval '1 week'
                         when 'month' then interval '1 month'
                         else interval '1 day' end as iv
  ),
  buckets as (
    select generate_series(date_trunc(p_bucket, p_since), date_trunc(p_bucket, now()), (select iv from step)) as b
  ),
  s as (select * from public.landing_sessions(p_since)),
  agg as (
    select date_trunc(p_bucket, started_at) as b,
      count(*)::int as sessions,
      (count(*) filter (where cta_clicks > 0))::int as cta,
      (count(*) filter (where signup_completed))::int as signups,
      (count(*) filter (where payment_success))::int as payments
    from s group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', to_char(buckets.b at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'sessions', coalesce(agg.sessions, 0),
    'ctaClicks', coalesce(agg.cta, 0),
    'signups', coalesce(agg.signups, 0),
    'payments', coalesce(agg.payments, 0)
  ) order by buckets.b), '[]'::jsonb)
  from buckets left join agg on agg.b = buckets.b;
$$;

-- ---------- Activité en direct (aucune PII) ----------
create or replace function public.landing_live(p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', event_type, 'segment', segment, 'device', device, 'source', source,
    'country', country, 'section', section, 'element', element, 'value', value, 'at', created_at
  ) order by created_at desc), '[]'::jsonb)
  from (
    select event_type, segment, device, source, country, section, element, value, created_at
    from public.landing_events
    order by created_at desc
    limit greatest(1, least(p_limit, 60))
  ) e;
$$;

-- ---------- Effet réel de la personnalisation ----------
-- Compare les sessions personnalisées au GROUPE TÉMOIN (une part du trafic
-- ignore volontairement les règles). Sans ce témoin, « la personnalisation
-- fonctionne » ne serait qu'une croyance.
create or replace function public.landing_personalization_effect(p_since timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with expo as (
    select distinct on (e.session_id)
      e.session_id,
      coalesce((e.meta->>'personalized')::boolean, false) as personalized
    from public.landing_events e
    where e.event_type = 'exposure' and e.created_at >= p_since and e.session_id is not null
    order by e.session_id, e.created_at asc
  ),
  s as (select * from public.landing_sessions(p_since)),
  j as (select s.*, expo.personalized from s join expo on expo.session_id = s.session_id)
  select jsonb_build_object(
    'personalized', (
      select jsonb_build_object(
        'sessions', count(*), 'engaged', count(*) filter (where engaged),
        'ctaClicks', count(*) filter (where cta_clicks > 0),
        'signups', count(*) filter (where signup_completed))
      from j where personalized),
    'control', (
      select jsonb_build_object(
        'sessions', count(*), 'engaged', count(*) filter (where engaged),
        'ctaClicks', count(*) filter (where cta_clicks > 0),
        'signups', count(*) filter (where signup_completed))
      from j where not personalized)
  );
$$;

-- ---------- Purge (rétention) ----------
-- Les événements bruts n'ont d'intérêt que quelques mois : au-delà, les
-- versions et leurs statistiques agrégées suffisent.
create or replace function public.landing_prune_events(p_days integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.landing_events
  where created_at < now() - make_interval(days => greatest(30, p_days));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- =============================================================
-- 5. Verrouillage des fonctions
-- =============================================================

revoke all on function public.landing_sessions(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_kpis(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_funnel(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_variant_stats(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_segment_stats(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_segment_variant_stats(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_device_stats(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_sections(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_scrollmap(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_heatmap(timestamptz, text) from public, anon, authenticated;
revoke all on function public.landing_elements(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_series(text, timestamptz) from public, anon, authenticated;
revoke all on function public.landing_live(integer) from public, anon, authenticated;
revoke all on function public.landing_personalization_effect(timestamptz) from public, anon, authenticated;
revoke all on function public.landing_prune_events(integer) from public, anon, authenticated;

commit;
