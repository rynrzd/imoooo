-- =============================================================
-- ImmoPilot — script unique à exécuter dans Supabase SQL Editor
-- Projet : vetzweeeywgxytuqspqb
-- Regroupe les 3 migrations (init + profiles_email_plan + app_extensions)
-- en un seul script IDEMPOTENT et TRANSACTIONNEL (rejouable sans risque).
-- Copier-coller la totalité dans SQL Editor → Run.
-- Aucune donnée fictive, aucune clé, aucun secret.
-- =============================================================

begin;

-- ---------- Fonctions utilitaires ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

-- ---------- profiles ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  email text not null default '',
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Colonnes email/plan (si la table préexistait sans elles).
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists plan  text not null default 'free';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_check') then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'essentiel', 'investisseur', 'pro'));
  end if;
end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- properties ----------

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text not null,
  postal_code text not null,
  city text not null,
  type text not null check (type in ('Studio', 'T1', 'T2', 'T3', 'T4', 'T5', 'Maison')),
  surface numeric(7, 2) not null check (surface > 0),
  rooms integer not null check (rooms >= 1),
  photo_url text,
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  purchase_date date not null,
  rent numeric(10, 2) not null check (rent >= 0),
  charges numeric(10, 2) not null default 0 check (charges >= 0),
  status text not null default 'vacant' check (status in ('loue', 'vacant', 'travaux')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_owner_idx on public.properties (owner_id);

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------- tenants ----------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenants_owner_idx on public.tenants (owner_id);

drop trigger if exists tenants_updated_at on public.tenants;
create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ---------- leases (baux : lien locataire <-> logement) ----------

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  entry_date date not null,
  exit_date date check (exit_date is null or exit_date >= entry_date),
  rent numeric(10, 2) not null check (rent >= 0),
  charges numeric(10, 2) not null default 0 check (charges >= 0),
  deposit numeric(10, 2) not null default 0 check (deposit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leases_owner_idx on public.leases (owner_id);
create index if not exists leases_property_idx on public.leases (property_id);
create index if not exists leases_tenant_idx on public.leases (tenant_id);
create unique index if not exists leases_one_active_per_property
  on public.leases (property_id) where exit_date is null;

drop trigger if exists leases_updated_at on public.leases;
create trigger leases_updated_at
  before update on public.leases
  for each row execute function public.set_updated_at();

-- ---------- rent_payments ----------

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  lease_id uuid not null references public.leases (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  expected numeric(10, 2) not null check (expected >= 0),
  received numeric(10, 2) not null default 0 check (received >= 0),
  paid_at date,
  status text not null default 'attente' check (status in ('paye', 'attente', 'retard', 'partiel')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, month)
);

create index if not exists rent_payments_owner_idx on public.rent_payments (owner_id);
create index if not exists rent_payments_lease_idx on public.rent_payments (lease_id);
create index if not exists rent_payments_month_idx on public.rent_payments (owner_id, month desc);

drop trigger if exists rent_payments_updated_at on public.rent_payments;
create trigger rent_payments_updated_at
  before update on public.rent_payments
  for each row execute function public.set_updated_at();

-- ---------- maintenance_records (travaux) ----------

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null,
  company text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null,
  status text not null default 'planifie' check (status in ('planifie', 'en_cours', 'termine')),
  actual_cost numeric(12, 2) check (actual_cost is null or actual_cost >= 0),
  progress smallint check (progress is null or (progress between 0 and 100)),
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maintenance_records
  add column if not exists actual_cost numeric(12, 2) check (actual_cost is null or actual_cost >= 0);
alter table public.maintenance_records
  add column if not exists progress smallint check (progress is null or (progress between 0 and 100));
alter table public.maintenance_records add column if not exists end_date date;

create index if not exists maintenance_owner_idx on public.maintenance_records (owner_id);
create index if not exists maintenance_property_idx on public.maintenance_records (property_id);

drop trigger if exists maintenance_updated_at on public.maintenance_records;
create trigger maintenance_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_updated_at();

-- ---------- documents ----------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,
  category text not null check (category in
    ('bail', 'etat_des_lieux', 'assurance', 'diagnostics', 'factures', 'garanties', 'autres')),
  file_path text,
  file_type text not null default 'pdf',
  size_bytes bigint,
  maintenance_record_id uuid references public.maintenance_records (id) on delete set null,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists expires_at date;

create index if not exists documents_owner_idx on public.documents (owner_id);
create index if not exists documents_property_idx on public.documents (property_id);
create index if not exists documents_category_idx on public.documents (owner_id, category);
create index if not exists documents_expiry_idx on public.documents (owner_id, expires_at)
  where expires_at is not null;

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------- expenses ----------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  label text not null,
  category text not null check (category in
    ('travaux', 'assurance', 'taxe_fonciere', 'copropriete', 'autres')),
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null,
  supplier text not null default '',
  maintenance_record_id uuid references public.maintenance_records (id) on delete set null,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses add column if not exists supplier text not null default '';

create index if not exists expenses_owner_idx on public.expenses (owner_id);
create index if not exists expenses_property_idx on public.expenses (property_id);
create index if not exists expenses_date_idx on public.expenses (owner_id, date desc);

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------- property_photos ----------

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  file_path text not null,
  caption text not null default '',
  category text not null check (category in
    ('avant_location', 'apres_travaux', 'entree', 'sortie', 'dommages')),
  taken_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists property_photos_owner_idx on public.property_photos (owner_id);
create index if not exists property_photos_property_idx on public.property_photos (property_id);

-- =============================================================
-- Row Level Security
-- =============================================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_payments enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.documents enable row level security;
alter table public.expenses enable row level security;
alter table public.property_photos enable row level security;

-- profiles : id = auth.uid()
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using ((select auth.uid()) = id);

-- properties
drop policy if exists "properties_select_own" on public.properties;
create policy "properties_select_own" on public.properties
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "properties_insert_own" on public.properties;
create policy "properties_insert_own" on public.properties
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "properties_update_own" on public.properties;
create policy "properties_update_own" on public.properties
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "properties_delete_own" on public.properties;
create policy "properties_delete_own" on public.properties
  for delete using ((select auth.uid()) = owner_id);

-- tenants
drop policy if exists "tenants_select_own" on public.tenants;
create policy "tenants_select_own" on public.tenants
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "tenants_insert_own" on public.tenants;
create policy "tenants_insert_own" on public.tenants
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "tenants_update_own" on public.tenants;
create policy "tenants_update_own" on public.tenants
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "tenants_delete_own" on public.tenants;
create policy "tenants_delete_own" on public.tenants
  for delete using ((select auth.uid()) = owner_id);

-- leases
drop policy if exists "leases_select_own" on public.leases;
create policy "leases_select_own" on public.leases
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "leases_insert_own" on public.leases;
create policy "leases_insert_own" on public.leases
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "leases_update_own" on public.leases;
create policy "leases_update_own" on public.leases
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "leases_delete_own" on public.leases;
create policy "leases_delete_own" on public.leases
  for delete using ((select auth.uid()) = owner_id);

-- rent_payments
drop policy if exists "rent_payments_select_own" on public.rent_payments;
create policy "rent_payments_select_own" on public.rent_payments
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "rent_payments_insert_own" on public.rent_payments;
create policy "rent_payments_insert_own" on public.rent_payments
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "rent_payments_update_own" on public.rent_payments;
create policy "rent_payments_update_own" on public.rent_payments
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "rent_payments_delete_own" on public.rent_payments;
create policy "rent_payments_delete_own" on public.rent_payments
  for delete using ((select auth.uid()) = owner_id);

-- maintenance_records
drop policy if exists "maintenance_select_own" on public.maintenance_records;
create policy "maintenance_select_own" on public.maintenance_records
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "maintenance_insert_own" on public.maintenance_records;
create policy "maintenance_insert_own" on public.maintenance_records
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "maintenance_update_own" on public.maintenance_records;
create policy "maintenance_update_own" on public.maintenance_records
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "maintenance_delete_own" on public.maintenance_records;
create policy "maintenance_delete_own" on public.maintenance_records
  for delete using ((select auth.uid()) = owner_id);

-- documents
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents
  for delete using ((select auth.uid()) = owner_id);

-- expenses
drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses
  for delete using ((select auth.uid()) = owner_id);

-- property_photos
drop policy if exists "photos_select_own" on public.property_photos;
create policy "photos_select_own" on public.property_photos
  for select using ((select auth.uid()) = owner_id);
drop policy if exists "photos_insert_own" on public.property_photos;
create policy "photos_insert_own" on public.property_photos
  for insert with check ((select auth.uid()) = owner_id);
drop policy if exists "photos_update_own" on public.property_photos;
create policy "photos_update_own" on public.property_photos
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "photos_delete_own" on public.property_photos;
create policy "photos_delete_own" on public.property_photos
  for delete using ((select auth.uid()) = owner_id);

-- =============================================================
-- Storage : buckets privés + politiques par dossier utilisateur
-- Convention de chemin : {owner_id}/{property_id?}/{fichier}
-- =============================================================

insert into storage.buckets (id, name, public)
values
  ('property-documents', 'property-documents', false),
  ('property-photos', 'property-photos', false),
  ('expense-receipts', 'expense-receipts', false),
  ('profile-avatars', 'profile-avatars', false),
  ('maintenance-files', 'maintenance-files', false)
on conflict (id) do nothing;

drop policy if exists "storage_select_own" on storage.objects;
create policy "storage_select_own" on storage.objects
  for select using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "storage_insert_own" on storage.objects;
create policy "storage_insert_own" on storage.objects
  for insert with check (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "storage_update_own" on storage.objects;
create policy "storage_update_own" on storage.objects
  for update using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "storage_delete_own" on storage.objects;
create policy "storage_delete_own" on storage.objects
  for delete using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars', 'maintenance-files')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------- rattrapage des profils existants (comptes déjà créés) ----------

insert into public.profiles (id, email, full_name, plan)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'full_name', ''), 'free'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

commit;

-- Vérification rapide (facultatif) :
-- select table_name from information_schema.tables
-- where table_schema = 'public' order by table_name;
