-- =============================================================
-- Nireo — accès self-service au tableau de bord partenaire (P8).
-- Jeton secret par partenaire (distinct du referral_code, qui apparaît
-- dans les liens publics). 64 caractères hex ≈ 256 bits d'aléa.
-- L'accès se fait par ce jeton (cookie HttpOnly), sans compte Supabase.
-- Idempotent.
-- =============================================================

begin;

alter table public.marketing_partners
  add column if not exists dashboard_token text;

-- Backfill des partenaires existants.
update public.marketing_partners
  set dashboard_token =
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where dashboard_token is null;

-- Nouveaux partenaires : jeton généré automatiquement.
alter table public.marketing_partners
  alter column dashboard_token set default
    (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

alter table public.marketing_partners
  alter column dashboard_token set not null;

create unique index if not exists marketing_partners_dashboard_token_idx
  on public.marketing_partners (dashboard_token);

commit;
