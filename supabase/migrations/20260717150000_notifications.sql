-- =============================================================
-- ImmoPilot — centre de notifications + préférences par canal +
-- configuration des rappels de loyers impayés.
-- Idempotent. Requiert 20260717090000_account_settings.sql.
-- =============================================================

begin;

-- ---------- profiles : onboarding ----------

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists product_tour_completed boolean not null default false;

-- Colonnes modifiables par l'utilisateur (privilèges par colonne).
grant update (full_name, phone, avatar_url, company_name,
  onboarding_completed, product_tour_completed)
  on table public.profiles to authenticated;

-- ---------- notifications ----------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null check (category in
    ('loyers', 'documents', 'travaux', 'securite', 'abonnements', 'systeme')),
  priority text not null default 'normale' check (priority in ('haute', 'normale', 'basse')),
  href text,
  read boolean not null default false,
  -- Clé d'unicité logique (ex. rent_late:<payment_id>) : évite les doublons
  -- quand les alertes sont régénérées à chaque chargement.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using ((select auth.uid()) = user_id);
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using ((select auth.uid()) = user_id);

-- ---------- préférences : canal in-app par type ----------
-- Les colonnes existantes valent pour le canal e-mail ;
-- les colonnes *_app valent pour le canal in-app.

alter table public.notification_preferences
  add column if not exists rent_late_app boolean not null default true,
  add column if not exists payment_received_app boolean not null default true,
  add column if not exists lease_expiring_app boolean not null default true,
  add column if not exists document_expiring_app boolean not null default true,
  add column if not exists maintenance_overdue_app boolean not null default true,
  add column if not exists monthly_report_app boolean not null default false,
  add column if not exists product_updates_app boolean not null default false;

-- ---------- rappels de loyers impayés (configurable) ----------
-- mode : notification seule / e-mail au propriétaire / rappel automatique
-- au locataire (avec copie éventuelle). AUCUN envoi tant qu'un fournisseur
-- e-mail n'est pas configuré côté serveur.

-- ---------- email_logs (traçabilité des envois, anti-doublon) ----------

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  recipient text not null,
  subject text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  -- Anti-doublon des envois automatiques (ex. rent_late_tenant:<id>:J7).
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists email_logs_user_idx on public.email_logs (user_id, created_at desc);

alter table public.email_logs enable row level security;

drop policy if exists "email_logs_select_own" on public.email_logs;
create policy "email_logs_select_own" on public.email_logs
  for select using ((select auth.uid()) = user_id);
drop policy if exists "email_logs_insert_own" on public.email_logs;
create policy "email_logs_insert_own" on public.email_logs
  for insert with check ((select auth.uid()) = user_id);

alter table public.notification_preferences
  add column if not exists rent_reminder_mode text not null default 'notification'
    check (rent_reminder_mode in ('notification', 'email_owner', 'email_tenant')),
  add column if not exists rent_reminder_days smallint[] not null default '{3,7,15}',
  add column if not exists rent_reminder_copy_owner boolean not null default true,
  add column if not exists rent_reminder_custom_message text;

commit;
