-- =============================================================
-- Nireo — plans V3 : nouveaux plafonds de logements appliqués EN BASE.
--   Gratuit    : 1 logement
--   Starter    : 5 logements
--   Pro        : 12 logements
--   Business+  : 25 logements
--   Fondateur  : illimité (accès à vie)
--
-- La limite est la SEULE règle qui change (les prix vivent dans Stripe).
-- ⚠️ Alignée sur src/config/plans.ts. Idempotent (create or replace).
--
-- Cette règle est appliquée par un trigger BEFORE INSERT : impossible à
-- contourner depuis l'API, une Server Action, un script ou un import — toute
-- écriture passe par le trigger. Le plan est lu dans profiles.plan (colonne
-- modifiable UNIQUEMENT par le serveur).
-- =============================================================

begin;

-- Accès à vie (Fondateur) : aucune limite de logements, quel que soit le
-- plan support. Lecture de la table subscriptions (écrite serveur uniquement).
create or replace function public.owner_has_lifetime(p_owner uuid)
returns boolean
language sql
stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_owner and s.lifetime_access = true
  );
$$;

-- Plafond de logements par plan (Fondateur exempté en premier).
create or replace function public.enforce_property_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  max_properties integer;
  current_count integer;
begin
  -- Fondateur / accès à vie : logements illimités.
  if public.owner_has_lifetime(new.owner_id) then
    return new;
  end if;

  max_properties := case public.plan_of_owner(new.owner_id)
    when 'free' then 1
    when 'starter' then 5
    when 'pro' then 12
    when 'business' then 25
    else 1 -- valeur inconnue : traité comme Gratuit (fail-safe restrictif)
  end;

  if max_properties is not null then
    select count(*) into current_count
    from public.properties where owner_id = new.owner_id;
    if current_count >= max_properties then
      raise exception
        'Votre plan permet % logement(s) maximum. Passez à un plan supérieur pour en ajouter.',
        max_properties using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Le trigger properties_enforce_limit reste attaché à cette fonction
-- (create or replace conserve le lien) — rappel ceinture/bretelles :
drop trigger if exists properties_enforce_limit on public.properties;
create trigger properties_enforce_limit
  before insert on public.properties
  for each row execute function public.enforce_property_limit();

commit;
