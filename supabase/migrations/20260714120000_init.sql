-- =============================================================
-- ImmoPilot — schéma initial
-- Tables, contraintes, index, RLS, triggers, buckets Storage.
-- Chaque ligne appartient à un utilisateur (owner_id) : la RLS
-- garantit qu'il ne voit et ne modifie que ses propres données.
-- =============================================================

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

-- Crée automatiquement le profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

-- ---------- profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- properties ----------

create table public.properties (
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

create index properties_owner_idx on public.properties (owner_id);

create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------- tenants ----------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_owner_idx on public.tenants (owner_id);

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ---------- leases (baux : lien locataire ↔ logement) ----------

create table public.leases (
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

create index leases_owner_idx on public.leases (owner_id);
create index leases_property_idx on public.leases (property_id);
create index leases_tenant_idx on public.leases (tenant_id);
-- Un seul bail actif (sans date de sortie) par logement.
create unique index leases_one_active_per_property
  on public.leases (property_id)
  where exit_date is null;

create trigger leases_updated_at
  before update on public.leases
  for each row execute function public.set_updated_at();

-- ---------- rent_payments ----------

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  lease_id uuid not null references public.leases (id) on delete cascade,
  -- Premier jour du mois concerné (ex. 2026-07-01).
  month date not null check (extract(day from month) = 1),
  expected numeric(10, 2) not null check (expected >= 0),
  received numeric(10, 2) not null default 0 check (received >= 0),
  paid_at date,
  status text not null default 'attente'
    check (status in ('paye', 'attente', 'retard', 'partiel')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, month)
);

create index rent_payments_owner_idx on public.rent_payments (owner_id);
create index rent_payments_lease_idx on public.rent_payments (lease_id);
create index rent_payments_month_idx on public.rent_payments (owner_id, month desc);

create trigger rent_payments_updated_at
  before update on public.rent_payments
  for each row execute function public.set_updated_at();

-- ---------- maintenance_records (travaux) ----------

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null,
  company text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null,
  status text not null default 'planifie'
    check (status in ('planifie', 'en_cours', 'termine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maintenance_owner_idx on public.maintenance_records (owner_id);
create index maintenance_property_idx on public.maintenance_records (property_id);

create trigger maintenance_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_updated_at();

-- ---------- documents ----------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,
  category text not null check (category in
    ('bail', 'etat_des_lieux', 'assurance', 'diagnostics', 'factures', 'garanties', 'autres')),
  -- Chemin dans le bucket property-documents ({owner_id}/...).
  file_path text,
  file_type text not null default 'pdf',
  size_bytes bigint,
  maintenance_record_id uuid references public.maintenance_records (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_owner_idx on public.documents (owner_id);
create index documents_property_idx on public.documents (property_id);
create index documents_category_idx on public.documents (owner_id, category);

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------- expenses ----------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  label text not null,
  category text not null check (category in
    ('travaux', 'assurance', 'taxe_fonciere', 'copropriete', 'autres')),
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null,
  maintenance_record_id uuid references public.maintenance_records (id) on delete set null,
  -- Chemin du justificatif dans le bucket expense-receipts.
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_owner_idx on public.expenses (owner_id);
create index expenses_property_idx on public.expenses (property_id);
create index expenses_date_idx on public.expenses (owner_id, date desc);

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------- property_photos ----------

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  -- Chemin dans le bucket property-photos ({owner_id}/...), ou URL externe.
  file_path text not null,
  caption text not null default '',
  category text not null check (category in
    ('avant_location', 'apres_travaux', 'entree', 'sortie', 'dommages')),
  taken_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index property_photos_owner_idx on public.property_photos (owner_id);
create index property_photos_property_idx on public.property_photos (property_id);

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

-- profiles : chacun ne voit que son propre profil.
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles
  for delete using ((select auth.uid()) = id);

-- Tables métier : accès restreint au propriétaire (owner_id).
-- (policies identiques, générées table par table)

create policy "properties_select_own" on public.properties
  for select using ((select auth.uid()) = owner_id);
create policy "properties_insert_own" on public.properties
  for insert with check ((select auth.uid()) = owner_id);
create policy "properties_update_own" on public.properties
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "properties_delete_own" on public.properties
  for delete using ((select auth.uid()) = owner_id);

create policy "tenants_select_own" on public.tenants
  for select using ((select auth.uid()) = owner_id);
create policy "tenants_insert_own" on public.tenants
  for insert with check ((select auth.uid()) = owner_id);
create policy "tenants_update_own" on public.tenants
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "tenants_delete_own" on public.tenants
  for delete using ((select auth.uid()) = owner_id);

create policy "leases_select_own" on public.leases
  for select using ((select auth.uid()) = owner_id);
create policy "leases_insert_own" on public.leases
  for insert with check ((select auth.uid()) = owner_id);
create policy "leases_update_own" on public.leases
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "leases_delete_own" on public.leases
  for delete using ((select auth.uid()) = owner_id);

create policy "rent_payments_select_own" on public.rent_payments
  for select using ((select auth.uid()) = owner_id);
create policy "rent_payments_insert_own" on public.rent_payments
  for insert with check ((select auth.uid()) = owner_id);
create policy "rent_payments_update_own" on public.rent_payments
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "rent_payments_delete_own" on public.rent_payments
  for delete using ((select auth.uid()) = owner_id);

create policy "maintenance_select_own" on public.maintenance_records
  for select using ((select auth.uid()) = owner_id);
create policy "maintenance_insert_own" on public.maintenance_records
  for insert with check ((select auth.uid()) = owner_id);
create policy "maintenance_update_own" on public.maintenance_records
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "maintenance_delete_own" on public.maintenance_records
  for delete using ((select auth.uid()) = owner_id);

create policy "documents_select_own" on public.documents
  for select using ((select auth.uid()) = owner_id);
create policy "documents_insert_own" on public.documents
  for insert with check ((select auth.uid()) = owner_id);
create policy "documents_update_own" on public.documents
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "documents_delete_own" on public.documents
  for delete using ((select auth.uid()) = owner_id);

create policy "expenses_select_own" on public.expenses
  for select using ((select auth.uid()) = owner_id);
create policy "expenses_insert_own" on public.expenses
  for insert with check ((select auth.uid()) = owner_id);
create policy "expenses_update_own" on public.expenses
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "expenses_delete_own" on public.expenses
  for delete using ((select auth.uid()) = owner_id);

create policy "photos_select_own" on public.property_photos
  for select using ((select auth.uid()) = owner_id);
create policy "photos_insert_own" on public.property_photos
  for insert with check ((select auth.uid()) = owner_id);
create policy "photos_update_own" on public.property_photos
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
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
  ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

-- L'utilisateur ne peut lire/écrire que dans son propre dossier racine.
create policy "storage_select_own" on storage.objects
  for select using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage_insert_own" on storage.objects
  for insert with check (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage_update_own" on storage.objects
  for update using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage_delete_own" on storage.objects
  for delete using (
    bucket_id in ('property-documents', 'property-photos', 'expense-receipts', 'profile-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
