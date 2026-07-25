-- =============================================================
-- Nireo — état complet de l'assistant d'onboarding.
--
-- CAUSE DU BUG CORRIGÉE ICI : le guide écrivait `onboarding_completed_at`,
-- dont le privilège UPDATE par colonne n'est accordé qu'à partir de la
-- migration 20260719090000. Si celle-ci n'a pas été appliquée, l'écriture
-- échoue (« permission denied for column » / « column does not exist »)
-- alors que la LECTURE de `onboarding_completed` réussit — le guide s'affiche
-- mais ne peut pas s'enregistrer (toast rouge).
--
-- Cette migration GARANTIT (idempotent) la présence des colonnes ET le
-- re-grant COMPLET des colonnes de profil modifiables, et ajoute le suivi
-- par étape / ignoré / version pour la reprise et le versioning.
--
-- Compatible avec les comptes existants (aucune donnée écrasée).
-- À exécuter dans le SQL Editor Supabase.
-- =============================================================

begin;

-- Colonnes historiques (peuvent déjà exister — idempotent, ceinture-bretelles).
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists product_tour_completed boolean not null default false;

-- Nouvelles colonnes : progression par étape, ignoré (distinct de terminé),
-- date de début, version du guide vue.
alter table public.profiles
  add column if not exists onboarding_current_step smallint not null default 0,
  add column if not exists onboarding_skipped boolean not null default false,
  add column if not exists onboarding_skipped_at timestamptz,
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarding_version smallint not null default 1;

-- Comptes DÉJÀ terminés : jamais reproposer le guide actuel (borne la version
-- au niveau courant). N'affecte pas les comptes en cours.
update public.profiles
  set onboarding_version = 1
  where onboarding_completed = true
    and (onboarding_version is null or onboarding_version < 1);

-- Re-grant COMPLET et idempotent des colonnes de profil modifiables par
-- l'utilisateur authentifié. La persistance de l'onboarding passe désormais
-- par le serveur (clé secrète, POST /api/onboarding), donc INSENSIBLE aux
-- droits par colonne ; ce grant reste en place par cohérence et pour éviter
-- toute régression d'une écriture client (ex. product_tour_completed).
grant update (
  full_name, phone, avatar_url, company_name,
  onboarding_completed, onboarding_completed_at,
  onboarding_current_step, onboarding_skipped, onboarding_skipped_at,
  onboarding_started_at, onboarding_version, product_tour_completed
) on table public.profiles to authenticated;

commit;

-- Vérification (facultatif) — doit lister onboarding_completed_at :
-- select column_name, privilege_type
-- from information_schema.column_privileges
-- where table_name = 'profiles' and grantee = 'authenticated'
-- order by column_name;
