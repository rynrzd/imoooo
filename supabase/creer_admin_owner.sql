-- =============================================================
-- Création du PREMIER administrateur (rôle owner) — À EXÉCUTER
-- MANUELLEMENT dans le SQL Editor du Dashboard Supabase.
--
-- Prérequis : l'utilisateur doit déjà exister dans Supabase Auth
-- (créé depuis Dashboard → Authentication → Users → « Add user »,
-- avec « Auto Confirm User » coché — JAMAIS depuis /inscription).
--
-- Remplacez l'adresse e-mail ci-dessous par la vôtre, puis exécutez.
-- Idempotent : réexécutable sans risque.
-- =============================================================

insert into public.admin_users (user_id, role, is_active)
select u.id, 'owner', true
from auth.users u
where u.email = 'nireo.contacte@gmail.com'
on conflict (user_id) do update set role = 'owner', is_active = true;

-- Vérification : doit retourner une ligne avec role = owner.
select au.id, au.role, au.is_active, u.email
from public.admin_users au
join auth.users u on u.id = au.user_id;
