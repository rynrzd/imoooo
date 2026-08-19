-- =============================================================
-- Nireo — Limitation de débit PARTAGÉE entre instances
--
-- Pourquoi : `src/lib/rate-limit.ts` compte en mémoire. Sur Vercel, chaque
-- instance serverless a ses propres compteurs — une tentative répartie sur
-- assez d'instances contourne la limite. Acceptable pour du filtrage
-- anti-spam, PAS pour les deux surfaces où l'on devine un identifiant :
-- la connexion administrateur et l'accès partenaire.
--
-- Cette table donne un compteur commun à toutes les instances. Le code
-- l'utilise dès qu'elle existe et retombe silencieusement sur la mémoire
-- sinon : appliquer cette migration ACTIVE la protection, ne pas
-- l'appliquer laisse le comportement actuel inchangé.
-- =============================================================

begin;

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  hit_at timestamptz not null default now()
);

-- L'index sert la fenêtre glissante ET la purge.
create index if not exists rate_limit_hits_key_idx
  on public.rate_limit_hits (bucket_key, hit_at desc);

alter table public.rate_limit_hits enable row level security;
-- Aucune policy : invisible aux clients. Seule la clé secrète (service role)
-- passe, et uniquement via la fonction ci-dessous.
revoke all on table public.rate_limit_hits from anon, authenticated;

-- ---------- consume_rate_limit ----------
-- Retourne true si l'appel est autorisé (et le comptabilise), false si la
-- limite est atteinte. Un verrou consultatif par clé sérialise les appels
-- concurrents : sans lui, deux requêtes simultanées liraient le même
-- compteur et passeraient toutes les deux.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or p_key = '' or p_limit < 1 or p_window_seconds < 1 then
    -- Paramètres inexploitables : on n'invente pas une autorisation.
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_key));

  -- Purge des traces devenues inutiles pour CETTE clé (garde quatre
  -- fenêtres de marge, de quoi absorber une horloge décalée).
  delete from public.rate_limit_hits
   where bucket_key = p_key
     and hit_at < now() - make_interval(secs => p_window_seconds * 4);

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket_key = p_key
     and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket_key) values (p_key);
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;

commit;
