-- =============================================================
-- Nireo — audit RLS (D5) : verrouillage des fonctions internes.
--
-- Faille de défense en profondeur : deux fonctions SECURITY DEFINER
-- paramétrées gardaient le privilège EXECUTE accordé PAR DÉFAUT à PUBLIC
-- (aucun revoke, contrairement à toutes les autres fonctions sensibles
-- du projet). Étant SECURITY DEFINER, elles lisent profiles/subscriptions
-- en CONTOURNANT la RLS :
--   • plan_of_owner(uuid)     → plan de n'importe quel utilisateur ;
--   • owner_has_lifetime(uuid) → statut Fondateur de n'importe qui.
-- Un client authentifié connaissant un UUID cible pouvait donc lire une
-- information réservée. On révoque EXECUTE pour anon/authenticated.
--
-- Aucun impact fonctionnel : ces fonctions ne sont appelées que par les
-- triggers de quota (enforce_*), eux-mêmes SECURITY DEFINER — une fonction
-- DEFINER s'exécute avec les droits de son PROPRIÉTAIRE, pas de l'appelant,
-- donc les appels internes restent valides. Le serveur (clé secrète /
-- service role) conserve un accès complet. Les triggers se déclenchent
-- sans que l'appelant ait besoin du privilège EXECUTE.
--
-- Par cohérence, on révoque aussi PUBLIC sur les fonctions de trigger
-- (jamais destinées à un appel direct) — sans effet sur leur exécution.
--
-- Idempotent. Aucune donnée modifiée. À exécuter dans le SQL Editor.
-- =============================================================

begin;

-- ---------- Helpers de plan (lecture RLS-bypass) : serveur uniquement ----------

revoke all on function public.plan_of_owner(uuid)
  from public, anon, authenticated;

revoke all on function public.owner_has_lifetime(uuid)
  from public, anon, authenticated;

-- ---------- Fonctions de trigger : jamais appelées directement ----------

revoke all on function public.set_updated_at()
  from public, anon, authenticated;
revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.handle_new_user_subscription()
  from public, anon, authenticated;
revoke all on function public.enforce_owner_consistency()
  from public, anon, authenticated;
revoke all on function public.enforce_property_limit()
  from public, anon, authenticated;
revoke all on function public.enforce_active_tenant_limit()
  from public, anon, authenticated;
revoke all on function public.enforce_document_limit()
  from public, anon, authenticated;
revoke all on function public.enforce_photo_limit()
  from public, anon, authenticated;

commit;

-- Vérification (facultatif) — ne doit renvoyer aucune ligne pour
-- anon/authenticated sur ces fonctions :
-- select p.proname, r.rolname
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- cross join lateral aclexplode(p.proacl) a
-- join pg_roles r on r.oid = a.grantee
-- where n.nspname = 'public'
--   and p.proname in ('plan_of_owner', 'owner_has_lifetime')
--   and r.rolname in ('anon', 'authenticated');
