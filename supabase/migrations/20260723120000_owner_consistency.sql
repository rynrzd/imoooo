-- =============================================================
-- Nireo — cohérence de propriété inter-lignes (correctif sécurité).
--
-- Faille corrigée : les policies RLS INSERT ne vérifiaient que
--   owner_id = auth.uid(). Elles NE garantissaient PAS que la ressource
--   parente référencée (property_id, tenant_id, lease_id,
--   maintenance_record_id) appartenait au même propriétaire.
--
-- Conséquence prouvée : un utilisateur B pouvait insérer un bail ACTIF
--   pointant sur le logement d'un utilisateur A (property_id = A,
--   owner_id = B). L'index unique partiel leases_one_active_per_property
--   empêchait ensuite A d'attribuer son propre bail actif → déni de
--   service persistant sur le bien de A. Idem pour dépenses / documents /
--   photos / travaux / échéances référençant la ressource d'autrui.
--
-- Correctif : trigger BEFORE INSERT/UPDATE (SECURITY DEFINER) qui refuse
--   toute ligne dont une référence parente n'a pas le même owner_id.
--   Additif et idempotent — aucune donnée existante n'est modifiée ni
--   supprimée (toutes les lignes légitimes ont déjà un propriétaire
--   cohérent). Les écritures serveur (clé secrète : webhook, cron) restent
--   cohérentes et ne sont donc jamais bloquées.
-- =============================================================

begin;

create or replace function public.enforce_owner_consistency()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  ref_owner uuid;
begin
  if tg_table_name = 'leases' then
    select owner_id into ref_owner from public.properties where id = new.property_id;
    if ref_owner is distinct from new.owner_id then
      raise exception 'Référence croisée interdite : le logement n''appartient pas à cet utilisateur.'
        using errcode = '42501';
    end if;
    select owner_id into ref_owner from public.tenants where id = new.tenant_id;
    if ref_owner is distinct from new.owner_id then
      raise exception 'Référence croisée interdite : le locataire n''appartient pas à cet utilisateur.'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'rent_payments' then
    select owner_id into ref_owner from public.leases where id = new.lease_id;
    if ref_owner is distinct from new.owner_id then
      raise exception 'Référence croisée interdite : le bail n''appartient pas à cet utilisateur.'
        using errcode = '42501';
    end if;

  elsif tg_table_name in ('maintenance_records', 'documents', 'expenses', 'property_photos') then
    select owner_id into ref_owner from public.properties where id = new.property_id;
    if ref_owner is distinct from new.owner_id then
      raise exception 'Référence croisée interdite : le logement n''appartient pas à cet utilisateur.'
        using errcode = '42501';
    end if;
    -- Lien facultatif vers un chantier (documents, dépenses).
    if tg_table_name in ('documents', 'expenses') and new.maintenance_record_id is not null then
      select owner_id into ref_owner from public.maintenance_records where id = new.maintenance_record_id;
      if ref_owner is distinct from new.owner_id then
        raise exception 'Référence croisée interdite : le chantier n''appartient pas à cet utilisateur.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Un trigger par table concernée (BEFORE INSERT OR UPDATE).
drop trigger if exists leases_owner_consistency on public.leases;
create trigger leases_owner_consistency
  before insert or update on public.leases
  for each row execute function public.enforce_owner_consistency();

drop trigger if exists rent_payments_owner_consistency on public.rent_payments;
create trigger rent_payments_owner_consistency
  before insert or update on public.rent_payments
  for each row execute function public.enforce_owner_consistency();

drop trigger if exists maintenance_owner_consistency on public.maintenance_records;
create trigger maintenance_owner_consistency
  before insert or update on public.maintenance_records
  for each row execute function public.enforce_owner_consistency();

drop trigger if exists documents_owner_consistency on public.documents;
create trigger documents_owner_consistency
  before insert or update on public.documents
  for each row execute function public.enforce_owner_consistency();

drop trigger if exists expenses_owner_consistency on public.expenses;
create trigger expenses_owner_consistency
  before insert or update on public.expenses
  for each row execute function public.enforce_owner_consistency();

drop trigger if exists property_photos_owner_consistency on public.property_photos;
create trigger property_photos_owner_consistency
  before insert or update on public.property_photos
  for each row execute function public.enforce_owner_consistency();

commit;
