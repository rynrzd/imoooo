-- =============================================================
-- Nireo — module « Marketing & Partenaires » (espace admin).
-- Tables : marketing_partners, partner_clicks, partner_attributions,
-- partner_commissions, partner_payouts + vue partner_commission_totals
-- + fonctions record_partner_click / attach_partner_attribution /
-- mark_partner_payout_paid / cancel_partner_payout.
--
-- Sécurité : RLS activée SANS policy sur toutes les tables (comme les
-- autres tables admin) → invisibles aux clients anon/authenticated.
-- Seule la clé secrète serveur lit et écrit. Les fonctions sensibles
-- sont exécutables uniquement par le service role.
--
-- Argent : TOUS les montants sont stockés en CENTIMES (integer),
-- sauf commission_value / commission_rate : numeric(10,2) —
-- pourcentage si commission_type = 'percent', euros si 'fixed'.
--
-- Règle d'attribution : PREMIER partenaire attribué (first-touch).
-- Une attribution existante (cookie ou ligne) n'est jamais écrasée.
--
-- Idempotent. Aucune donnée existante supprimée ni modifiée.
-- =============================================================

begin;

-- ---------- 1. marketing_partners ----------
-- Un partenaire = un professionnel apporteur d'affaires (assurance,
-- agence, courtier…). referral_code : aléatoire non devinable ;
-- referral_slug : lisible (lien « propre »). Le tracking accepte les 2.

create table if not exists public.marketing_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  company_name text not null default '',
  partner_type text not null default 'autre' check (partner_type in (
    'assurance', 'agence_immobiliere', 'courtier', 'comptable',
    'notaire', 'artisan', 'influenceur', 'autre'
  )),
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  referral_code text not null unique check (char_length(referral_code) between 6 and 40),
  referral_slug text not null unique check (referral_slug ~ '^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])?$'),
  -- 'percent' : commission_value = % du montant encaissé HT.
  -- 'fixed'   : commission_value = montant en euros, UNE fois par client payant.
  commission_type text not null default 'percent' check (commission_type in ('percent', 'fixed')),
  commission_value numeric(10, 2) not null default 0 check (commission_value >= 0),
  -- Durée du droit à commission (percent uniquement) :
  -- 'first_payment' = premier paiement seulement, 'months' = N mois,
  -- 'lifetime' = tant que l'abonnement reste actif.
  commission_duration_type text not null default 'first_payment'
    check (commission_duration_type in ('first_payment', 'months', 'lifetime')),
  commission_duration_months integer
    check (commission_duration_months is null or commission_duration_months > 0),
  -- Plans ouvrant droit à commission (vide = tous les plans payants).
  applicable_plans text[] not null default '{}',
  attribution_window_days integer not null default 30
    check (attribution_window_days between 1 and 365),
  -- Règle unique du projet : first_click. Colonne conservée pour audit.
  attribution_model text not null default 'first_click'
    check (attribution_model in ('first_click')),
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_partners_active_idx
  on public.marketing_partners (is_active, created_at desc);

drop trigger if exists marketing_partners_updated_at on public.marketing_partners;
create trigger marketing_partners_updated_at
  before update on public.marketing_partners
  for each row execute function public.set_updated_at();

alter table public.marketing_partners enable row level security;
revoke all on table public.marketing_partners from anon, authenticated;

-- ---------- 2. partner_clicks ----------
-- Un clic réel = une arrivée sur le site avec ?ref=… validée serveur.
-- ip_hash : SHA-256 salé de l'IP (jamais l'IP en clair — anti-fraude
-- sans stockage de donnée personnelle). Dédupliqué par la fonction
-- record_partner_click (fenêtre 10 min + plafond quotidien).

create table if not exists public.partner_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.marketing_partners (id) on delete cascade,
  referral_code text not null,
  landing_page text not null default '/',
  source text not null default '',
  campaign text not null default '',
  ip_hash text not null default '',
  user_agent text not null default '',
  clicked_at timestamptz not null default now()
);

create index if not exists partner_clicks_partner_idx
  on public.partner_clicks (partner_id, clicked_at desc);
create index if not exists partner_clicks_dedupe_idx
  on public.partner_clicks (partner_id, ip_hash, clicked_at desc);

alter table public.partner_clicks enable row level security;
revoke all on table public.partner_clicks from anon, authenticated;

-- ---------- 3. partner_attributions ----------
-- Rattachement d'un COMPTE à un partenaire (créé à l'inscription).
-- unique (user_id) = first-touch : le premier partenaire gagne,
-- jamais écrasé. status : signed_up → converted (1er paiement).

create table if not exists public.partner_attributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.marketing_partners (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  referral_code text not null,
  first_click_at timestamptz,
  signup_at timestamptz not null default now(),
  converted_at timestamptz,
  status text not null default 'signed_up' check (status in ('signed_up', 'converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_attributions_partner_idx
  on public.partner_attributions (partner_id, signup_at desc);

drop trigger if exists partner_attributions_updated_at on public.partner_attributions;
create trigger partner_attributions_updated_at
  before update on public.partner_attributions
  for each row execute function public.set_updated_at();

alter table public.partner_attributions enable row level security;
revoke all on table public.partner_attributions from anon, authenticated;

-- ---------- 4. partner_commissions ----------
-- Une commission = UN paiement Stripe réellement encaissé (webhook
-- invoice.paid). stripe_invoice_id UNIQUE = idempotence absolue :
-- un événement Stripe rejoué ne crée jamais de doublon.
-- Montants en centimes. Cycle : pending → approved → payable → paid ;
-- cancelled (admin) / reversed (remboursement Stripe).

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.marketing_partners (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  subscription_id text not null default '',
  stripe_invoice_id text not null unique,
  stripe_payment_intent_id text not null default '',
  plan text not null default '',
  -- Montant TTC réellement encaissé (centimes).
  gross_amount integer not null check (gross_amount >= 0),
  -- Assiette de calcul : encaissé moins taxes (centimes).
  eligible_amount integer not null check (eligible_amount >= 0),
  commission_type text not null check (commission_type in ('percent', 'fixed')),
  -- % appliqué (percent) ou montant en euros (fixed) — copie au moment du calcul.
  commission_rate numeric(10, 2) not null default 0,
  -- Commission due (centimes).
  commission_amount integer not null check (commission_amount >= 0),
  currency text not null default 'eur',
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'payable', 'paid', 'cancelled', 'reversed'
  )),
  earned_at timestamptz not null default now(),
  approved_at timestamptz,
  payable_at timestamptz,
  paid_at timestamptz,
  payout_id uuid,
  reversal_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_commissions_partner_idx
  on public.partner_commissions (partner_id, earned_at desc);
create index if not exists partner_commissions_status_idx
  on public.partner_commissions (status, earned_at desc);
create index if not exists partner_commissions_user_idx
  on public.partner_commissions (user_id);
create index if not exists partner_commissions_payout_idx
  on public.partner_commissions (payout_id);
create index if not exists partner_commissions_pi_idx
  on public.partner_commissions (stripe_payment_intent_id);

drop trigger if exists partner_commissions_updated_at on public.partner_commissions;
create trigger partner_commissions_updated_at
  before update on public.partner_commissions
  for each row execute function public.set_updated_at();

alter table public.partner_commissions enable row level security;
revoke all on table public.partner_commissions from anon, authenticated;

-- ---------- 5. partner_payouts ----------
-- Relevé de paiement d'un partenaire (virement MANUEL en v1 : l'admin
-- vire puis marque payé). Cycle : draft → approved → paid ; cancelled.

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.marketing_partners (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  -- Total des commissions liées (centimes) — recalculé serveur, jamais fourni par le client.
  total_amount integer not null default 0 check (total_amount >= 0),
  currency text not null default 'eur',
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  payment_method text not null default '',
  payment_reference text not null default '',
  paid_at timestamptz,
  notes text not null default '',
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists partner_payouts_partner_idx
  on public.partner_payouts (partner_id, created_at desc);
create index if not exists partner_payouts_status_idx
  on public.partner_payouts (status, created_at desc);

drop trigger if exists partner_payouts_updated_at on public.partner_payouts;
create trigger partner_payouts_updated_at
  before update on public.partner_payouts
  for each row execute function public.set_updated_at();

alter table public.partner_payouts enable row level security;
revoke all on table public.partner_payouts from anon, authenticated;

-- Lien commissions → payout (après création des deux tables).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'partner_commissions_payout_fk'
  ) then
    alter table public.partner_commissions
      add constraint partner_commissions_payout_fk
      foreign key (payout_id) references public.partner_payouts (id) on delete set null;
  end if;
end $$;

-- ---------- 6. Vue cagnotte ----------
-- La cagnotte n'est JAMAIS une valeur modifiable : elle est calculée
-- depuis les commissions réelles. Vue réservée au service role.

create or replace view public.partner_commission_totals
with (security_invoker = false) as
  select
    partner_id,
    status,
    count(*)::integer as commissions_count,
    coalesce(sum(commission_amount), 0)::bigint as total_cents,
    coalesce(sum(gross_amount), 0)::bigint as gross_cents
  from public.partner_commissions
  group by partner_id, status;

revoke all on public.partner_commission_totals from anon, authenticated;

-- ---------- 7. record_partner_click ----------
-- Valide le partenaire (existe, actif, dates) puis enregistre le clic.
-- Anti-spam : un même ip_hash ne compte qu'un clic par partenaire par
-- fenêtre de 10 minutes, et 20 clics max par jour. Retourne les infos
-- nécessaires au cookie d'attribution.

create or replace function public.record_partner_click(
  p_ref text,
  p_landing text default '/',
  p_source text default '',
  p_campaign text default '',
  p_ip_hash text default '',
  p_user_agent text default ''
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_partner public.marketing_partners%rowtype;
  v_recent integer;
  v_daily integer;
  v_counted boolean := false;
begin
  select * into v_partner
  from public.marketing_partners
  where (referral_slug = lower(trim(p_ref)) or referral_code = trim(p_ref));

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'unknown');
  end if;
  if not v_partner.is_active then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if v_partner.starts_at is not null and now() < v_partner.starts_at then
    return jsonb_build_object('valid', false, 'reason', 'not_started');
  end if;
  if v_partner.expires_at is not null and now() > v_partner.expires_at then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  -- Déduplication : rafraîchissements / auto-clics immédiats.
  select count(*) into v_recent
  from public.partner_clicks
  where partner_id = v_partner.id
    and ip_hash = p_ip_hash
    and p_ip_hash <> ''
    and clicked_at > now() - interval '10 minutes';

  select count(*) into v_daily
  from public.partner_clicks
  where partner_id = v_partner.id
    and ip_hash = p_ip_hash
    and p_ip_hash <> ''
    and clicked_at > now() - interval '24 hours';

  if v_recent = 0 and v_daily < 20 then
    insert into public.partner_clicks
      (partner_id, referral_code, landing_page, source, campaign, ip_hash, user_agent)
    values (
      v_partner.id,
      v_partner.referral_code,
      left(coalesce(p_landing, '/'), 300),
      left(coalesce(p_source, ''), 120),
      left(coalesce(p_campaign, ''), 120),
      left(coalesce(p_ip_hash, ''), 128),
      left(coalesce(p_user_agent, ''), 300)
    );
    v_counted := true;
  end if;

  return jsonb_build_object(
    'valid', true,
    'counted', v_counted,
    'partner_id', v_partner.id,
    'slug', v_partner.referral_slug,
    'window_days', v_partner.attribution_window_days
  );
end;
$$;

revoke all on function public.record_partner_click(text, text, text, text, text, text)
  from public, anon, authenticated;

-- ---------- 8. attach_partner_attribution ----------
-- Rattache un compte au partenaire du cookie, à l'inscription.
-- First-touch : si le compte est déjà attribué, on garde l'existant.
-- Anti self-referral : l'e-mail du compte ne doit pas être celui du
-- partenaire. Jamais d'attribution pour un compte administrateur.

create or replace function public.attach_partner_attribution(
  p_user_id uuid,
  p_ref text,
  p_first_click_at timestamptz default null
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_partner public.marketing_partners%rowtype;
  v_user_email text;
  v_existing uuid;
begin
  select partner_id into v_existing
  from public.partner_attributions where user_id = p_user_id;
  if found then
    return jsonb_build_object('attached', false, 'reason', 'already_attributed');
  end if;

  select * into v_partner
  from public.marketing_partners
  where (referral_slug = lower(trim(p_ref)) or referral_code = trim(p_ref));
  if not found then
    return jsonb_build_object('attached', false, 'reason', 'unknown');
  end if;
  if not v_partner.is_active
     or (v_partner.starts_at is not null and now() < v_partner.starts_at)
     or (v_partner.expires_at is not null and now() > v_partner.expires_at) then
    return jsonb_build_object('attached', false, 'reason', 'inactive_or_expired');
  end if;

  -- Self-referral : le partenaire ne peut pas se parrainer lui-même.
  select lower(email) into v_user_email from auth.users where id = p_user_id;
  if v_user_email is not null and v_user_email <> ''
     and v_user_email = lower(trim(v_partner.email)) then
    return jsonb_build_object('attached', false, 'reason', 'self_referral');
  end if;

  -- Jamais d'attribution pour un administrateur Nireo.
  if exists (select 1 from public.admin_users where user_id = p_user_id) then
    return jsonb_build_object('attached', false, 'reason', 'admin_account');
  end if;

  insert into public.partner_attributions
    (partner_id, user_id, referral_code, first_click_at, signup_at, status)
  values (v_partner.id, p_user_id, v_partner.referral_code, p_first_click_at, now(), 'signed_up')
  on conflict (user_id) do nothing;

  return jsonb_build_object('attached', true, 'partner_id', v_partner.id);
end;
$$;

revoke all on function public.attach_partner_attribution(uuid, text, timestamptz)
  from public, anon, authenticated;

-- ---------- 9. mark_partner_payout_paid ----------
-- Passage ATOMIQUE d'un relevé à « payé » : le payout ET ses commissions
-- basculent ensemble. Anti double paiement : refuse un payout déjà payé
-- ou annulé. total_amount recalculé depuis les commissions liées.

create or replace function public.mark_partner_payout_paid(
  p_payout_id uuid,
  p_payment_method text,
  p_payment_reference text,
  p_notes text default ''
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_status text;
  v_total bigint;
  v_count integer;
begin
  select status into v_status
  from public.partner_payouts where id = p_payout_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status = 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'already_paid');
  end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'cancelled');
  end if;

  select coalesce(sum(commission_amount), 0), count(*)
    into v_total, v_count
  from public.partner_commissions
  where payout_id = p_payout_id and status = 'payable';

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_commissions');
  end if;

  update public.partner_commissions
  set status = 'paid', paid_at = now()
  where payout_id = p_payout_id and status = 'payable';

  update public.partner_payouts
  set status = 'paid',
      paid_at = now(),
      total_amount = v_total,
      payment_method = left(coalesce(p_payment_method, ''), 80),
      payment_reference = left(coalesce(p_payment_reference, ''), 160),
      notes = case when coalesce(p_notes, '') <> '' then left(p_notes, 1000) else notes end
  where id = p_payout_id;

  return jsonb_build_object('ok', true, 'total_cents', v_total, 'count', v_count);
end;
$$;

revoke all on function public.mark_partner_payout_paid(uuid, text, text, text)
  from public, anon, authenticated;

-- ---------- 10. cancel_partner_payout ----------
-- Annule un relevé NON payé : les commissions liées redeviennent
-- payables (payout_id remis à null). Un relevé payé ne s'annule pas.

create or replace function public.cancel_partner_payout(p_payout_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.partner_payouts where id = p_payout_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status = 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'already_paid');
  end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'cancelled');
  end if;

  update public.partner_commissions
  set payout_id = null
  where payout_id = p_payout_id and status = 'payable';

  update public.partner_payouts
  set status = 'cancelled'
  where id = p_payout_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cancel_partner_payout(uuid)
  from public, anon, authenticated;

commit;
