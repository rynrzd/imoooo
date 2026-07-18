-- =============================================================
-- ImmoPilot — paramètres du compte.
-- 1. profiles.company_name (entreprise / SCI, facultatif).
-- 2. Table notification_preferences (préférences persistantes, RLS).
-- 3. Privilèges par colonne réaffirmés (le plan reste protégé).
-- Idempotent — à exécuter dans le SQL Editor.
-- =============================================================

begin;

-- ---------- profiles : entreprise / SCI ----------

alter table public.profiles add column if not exists company_name text;

-- Privilèges par colonne (remplace/complète protect_plan_column) :
-- l'utilisateur ne modifie jamais plan ni email directement en base.
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, company_name)
  on table public.profiles to authenticated;

-- subscriptions : lecture seule côté utilisateur.
revoke insert, update, delete on table public.subscriptions from anon, authenticated;

-- ---------- notification_preferences ----------
-- Les e-mails automatiques ne sont pas encore branchés : cette table
-- enregistre les choix, l'envoi sera activé plus tard sans changement ici.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rent_late boolean not null default true,
  payment_received boolean not null default true,
  lease_expiring boolean not null default true,
  document_expiring boolean not null default true,
  maintenance_overdue boolean not null default false,
  monthly_report boolean not null default false,
  product_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs_select_own" on public.notification_preferences;
create policy "notif_prefs_select_own" on public.notification_preferences
  for select using ((select auth.uid()) = user_id);
drop policy if exists "notif_prefs_insert_own" on public.notification_preferences;
create policy "notif_prefs_insert_own" on public.notification_preferences
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "notif_prefs_update_own" on public.notification_preferences;
create policy "notif_prefs_update_own" on public.notification_preferences
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
