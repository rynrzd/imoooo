-- =============================================================
-- ImmoPilot — messages du formulaire de contact public.
-- Écrits UNIQUEMENT par le serveur (clé secrète) : RLS activée
-- sans aucune policy → invisible et inaccessible aux clients.
-- Idempotent.
-- =============================================================

begin;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 1 and 2000),
  -- 'received' à l'insertion ; 'emailed' si la copie support est partie.
  status text not null default 'received' check (status in ('received', 'emailed')),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
-- Aucune policy : seule la clé secrète (service role) lit/écrit.

commit;
