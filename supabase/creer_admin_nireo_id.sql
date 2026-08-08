-- =============================================================
-- NIREO ID — création du PREMIER administrateur (rôle owner).
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor du Dashboard Supabase,
-- APRÈS la migration `20260808090000_nireo_id.sql`.
--
-- Les rôles Nireo ID sont VOLONTAIREMENT séparés de ceux de Nireo Immo
-- (`admin_users`) : être administrateur Nireo Immo ne donne aucun droit
-- sur /id/admin, et inversement. Un même compte peut figurer dans les
-- deux tables si vous le souhaitez — c'est alors un choix explicite.
--
-- Prérequis : l'utilisateur existe déjà dans Supabase Auth.
-- Remplacez l'adresse e-mail ci-dessous, puis exécutez.
-- Idempotent : réexécutable sans risque.
-- =============================================================

insert into public.nid_admins (user_id, role, is_active)
select u.id, 'owner', true
from auth.users u
where u.email = 'nireo.contacte@gmail.com'
on conflict (user_id) do update set role = 'owner', is_active = true;

-- Vérification : doit retourner une ligne avec role = owner.
select a.id, a.role, a.is_active, u.email
from public.nid_admins a
join auth.users u on u.id = a.user_id;
