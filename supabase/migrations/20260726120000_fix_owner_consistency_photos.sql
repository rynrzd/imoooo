-- =============================================================
-- Nireo — CORRECTIF CRITIQUE : ajout de photos impossible.
--
-- Symptôme : « record "new" has no field "maintenance_record_id" » à
-- l'insertion d'une photo (public.property_photos) et d'un chantier
-- (public.maintenance_records).
--
-- CAUSE RACINE : la fonction trigger enforce_owner_consistency()
-- (migration 20260723120000) traitait dans UNE MÊME branche les tables
-- ('maintenance_records', 'documents', 'expenses', 'property_photos') puis
-- exécutait :
--     if tg_table_name in ('documents','expenses')
--        and new.maintenance_record_id is not null then ...
-- PL/pgSQL PLANIFIE cette instruction quand l'exécution l'atteint, contre
-- l'enregistrement NEW réel. Pour property_photos / maintenance_records —
-- qui n'ont PAS la colonne maintenance_record_id — la planification échoue
-- (le AND ne court-circuite pas la résolution de champ). Résultat : toute
-- insertion de photo (ou de chantier) échoue, alors que le code applicatif
-- est correct (insertPhoto n'envoie jamais ce champ).
--
-- CORRECTIF DÉFINITIF : réécrire la fonction avec des branches PAR TABLE.
-- new.maintenance_record_id n'est référencé QUE dans la branche exclusive
-- à ('documents','expenses') — qui possèdent réellement la colonne. Les
-- autres tables n'atteignent jamais cette instruction : plus aucune
-- planification impossible. La colonne maintenance_record_id reste en place
-- (nécessaire sur documents/expenses). Aucune donnée modifiée, triggers
-- inchangés (create or replace conserve leurs liens). Idempotent.
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

  -- Tables rattachées UNIQUEMENT à un logement (aucune colonne chantier) :
  -- ne référence JAMAIS new.maintenance_record_id → plus d'erreur de planification.
  elsif tg_table_name in ('maintenance_records', 'property_photos') then
    select owner_id into ref_owner from public.properties where id = new.property_id;
    if ref_owner is distinct from new.owner_id then
      raise exception 'Référence croisée interdite : le logement n''appartient pas à cet utilisateur.'
        using errcode = '42501';
    end if;

  -- Tables rattachées à un logement ET, facultativement, à un chantier.
  -- Ces tables (documents, expenses) possèdent bien maintenance_record_id :
  -- la référence n'est donc atteinte QUE pour elles.
  elsif tg_table_name in ('documents', 'expenses') then
    select owner_id into ref_owner from public.properties where id = new.property_id;
    if ref_owner is distinct from new.owner_id then
      raise exception 'Référence croisée interdite : le logement n''appartient pas à cet utilisateur.'
        using errcode = '42501';
    end if;
    if new.maintenance_record_id is not null then
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

commit;

-- Vérification (facultatif) — doit réussir après application :
--   insert into public.property_photos (owner_id, property_id, file_path, category)
--   values ('<votre_user>', '<votre_logement>', 'chemin/x.jpg', 'entree');
