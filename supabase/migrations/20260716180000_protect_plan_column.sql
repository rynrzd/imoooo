-- =============================================================
-- ImmoPilot — protection de la colonne plan.
-- La policy RLS « update own » couvrait TOUTES les colonnes : un
-- utilisateur authentifié pouvait s'attribuer un plan payant via l'API
-- (et relever son quota serveur). Privilèges par colonne : le plan et
-- les abonnements ne sont modifiables que par le serveur (clé secrète).
-- Idempotent, à exécuter dans le SQL Editor.
-- =============================================================

begin;

-- profiles : l'utilisateur ne modifie que ses informations de profil.
-- (insert/delete retirés aussi : la création passe par le trigger
-- handle_new_user, SECURITY DEFINER, donc non affecté.)
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on table public.profiles to authenticated;

-- subscriptions : lecture seule pour les utilisateurs (déjà sans policy
-- d'écriture — ceinture et bretelles au niveau des privilèges).
revoke insert, update, delete on table public.subscriptions from anon, authenticated;

commit;

-- Vérification (facultatif) :
-- select grantee, privilege_type, column_name
-- from information_schema.column_privileges
-- where table_name = 'profiles' and grantee = 'authenticated';
