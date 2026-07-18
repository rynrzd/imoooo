-- Extensions applicatives : dépenses complètes, expiration des documents,
-- suivi de chantier enrichi, bucket maintenance-files.
-- À exécuter APRÈS 20260714120000_init.sql et 20260715090000_profiles_email_plan.sql.

-- ---------- expenses : fournisseur ----------

alter table public.expenses
  add column if not exists supplier text not null default '';

-- ---------- documents : date d'expiration ----------

alter table public.documents
  add column if not exists expires_at date;

create index if not exists documents_expiry_idx
  on public.documents (owner_id, expires_at)
  where expires_at is not null;

-- ---------- maintenance_records : suivi enrichi ----------

alter table public.maintenance_records
  add column if not exists actual_cost numeric(12, 2) check (actual_cost is null or actual_cost >= 0),
  add column if not exists progress smallint check (progress is null or (progress between 0 and 100)),
  add column if not exists end_date date;

-- ---------- Storage : bucket maintenance-files ----------

insert into storage.buckets (id, name, public)
values ('maintenance-files', 'maintenance-files', false)
on conflict (id) do nothing;

-- Les politiques Storage listent explicitement les buckets : on les
-- recrée pour inclure maintenance-files.
drop policy if exists "storage_select_own" on storage.objects;
drop policy if exists "storage_insert_own" on storage.objects;
drop policy if exists "storage_update_own" on storage.objects;
drop policy if exists "storage_delete_own" on storage.objects;

create policy "storage_select_own" on storage.objects
  for select using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "storage_insert_own" on storage.objects
  for insert with check (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "storage_update_own" on storage.objects
  for update using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "storage_delete_own" on storage.objects
  for delete using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
