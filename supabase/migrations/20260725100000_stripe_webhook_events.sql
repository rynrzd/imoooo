-- =============================================================
-- Nireo — idempotence des webhooks Stripe.
--
-- Chaque événement Stripe traité est enregistré par son `id`. Un événement
-- rejoué (reprise Stripe) ou livré en double est alors IGNORÉ avant tout
-- traitement — aucune double commission partenaire, double place Fondateur,
-- double abonnement, ni double incrément de compteur.
--
-- Écrite UNIQUEMENT par le serveur (clé secrète, qui contourne la RLS) :
-- RLS activée sans aucune policy → invisible et non modifiable côté client.
-- Idempotent. À exécuter dans le SQL Editor Supabase.
-- =============================================================

begin;

create table if not exists public.stripe_webhook_events (
  id text primary key,               -- Stripe event id (evt_…)
  type text not null default '',
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- Aucun accès direct client (le serveur écrit via la clé secrète).
revoke all on table public.stripe_webhook_events from anon, authenticated;

commit;

-- Purge éventuelle (à planifier plus tard, non requis pour l'idempotence) :
-- delete from public.stripe_webhook_events where received_at < now() - interval '90 days';
