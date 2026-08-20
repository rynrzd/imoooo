-- =============================================================
-- Nireo — Nouvelle categorie de document : « loyers »
--
-- POURQUOI
-- Les quittances et recus de loyer n'avaient aucune categorie propre :
-- ils finissaient dans « factures » (ou ce sont des depenses, pas des
-- recettes) ou dans « autres ». Or ce sont les documents les plus
-- nombreux d'un bailleur — un par mois et par logement — et les plus
-- souvent recherches. L'espace documentaire les regroupe desormais dans
-- une section « Loyers » dediee.
--
-- CE QUE FAIT CETTE MIGRATION
-- Elle elargit la contrainte CHECK de `public.documents.category` pour
-- accepter la valeur 'loyers', en plus des sept valeurs existantes.
-- Elle ne touche AUCUNE ligne : aucun document n'est reclasse, aucune
-- donnee n'est modifiee. C'est strictement une extension du domaine.
--
-- SANS CETTE MIGRATION, RIEN NE CASSE
-- L'application detecte le refus de la base (code Postgres 23514,
-- violation de contrainte CHECK) et retombe sur la categorie 'autres'
-- en prevenant l'utilisateur — voir `addDocument` dans src/lib/store.tsx.
-- Le document est donc TOUJOURS enregistre, avec son fichier. Appliquer
-- cette migration ne fait qu'activer le bon classement.
--
-- Idempotente : la contrainte est reconstruite a l'identique si elle
-- existe deja avec la nouvelle valeur.
-- =============================================================

begin;

-- Le nom de la contrainte est celui genere par Postgres a la creation de
-- la table (20260714120000_init.sql, contrainte CHECK anonyme sur la
-- colonne `category`). On le retrouve par introspection plutot que de le
-- deviner : selon la version, il peut etre `documents_category_check`.
do $$
declare
  nom_contrainte text;
begin
  select con.conname
    into nom_contrainte
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'documents'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%category%'
   limit 1;

  if nom_contrainte is not null then
    execute format('alter table public.documents drop constraint %I', nom_contrainte);
  end if;

  -- `not valid` serait inutile ici : on ELARGIT le domaine, donc aucune
  -- ligne existante ne peut violer la nouvelle contrainte. La validation
  -- immediate est sans risque et sans cout notable.
  alter table public.documents
    add constraint documents_category_check
    check (category in
      ('bail', 'loyers', 'etat_des_lieux', 'assurance',
       'diagnostics', 'factures', 'garanties', 'autres'));
end;
$$;

commit;

-- Verification apres application (doit lister la nouvelle definition,
-- avec 'loyers') :
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.documents'::regclass
--      and contype = 'c';
